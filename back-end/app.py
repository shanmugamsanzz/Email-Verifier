import os
import uuid
import threading
import time
import asyncio
from functools import wraps
from flask import Flask, render_template, request, jsonify, send_from_directory, make_response, g
from accounts import init_accounts, require_user, find_user
import pandas as pd
from verifier import async_advanced_email_verify
from flask_cors import CORS
from dotenv import load_dotenv
import io

# Load environment variables
load_dotenv()
API_KEY = os.getenv("API_KEY")

app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024
CORS(app)
init_accounts(app)

UPLOAD_FOLDER = "uploads"
RESULT_FOLDER = "static/results"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

BULK_EMAIL_DELAY_SECONDS = 1.5

jobs = {}
jobs_lock = threading.Lock()

# -------------------------------
# API Key Decorator
# -------------------------------
require_api_key = require_user


# -------------------------------
# Helper Functions
# -------------------------------
def save_results(df, filename):
    path = os.path.join(RESULT_FOLDER, filename)
    df.to_csv(path, index=False)
    return path


class Job:
    def __init__(self, job_id, emails, user_id):
        self.job_id = job_id
        self.user_id = user_id
        self.emails = emails
        self.progress = 0
        self.logs = []
        self.results = []
        self.is_cancelled = False
        self.is_complete = False
        self.is_failed = False
        self.lock = threading.Lock()
        self.download_files = {}

    def log(self, message):
        timestamp = time.strftime("%H:%M:%S")
        with self.lock:
            self.logs.append(f"[{timestamp}] {message}")

    async def run(self):
        self.log("Job started")
        total = len(self.emails)
        for i, email in enumerate(self.emails, 1):
            if self.is_cancelled:
                self.log("Job cancelled")
                break
            try:
                result = await async_advanced_email_verify(email)
                self.results.append(result)
                self.log(f"Processed: {email} - Status: {result.get('status')} ({result.get('checked_with_smtp')})")
            except Exception as e:
                self.log(f"Error processing {email}: {str(e)}")
            with self.lock:
                self.progress = int(i / total * 100)
            await asyncio.sleep(BULK_EMAIL_DELAY_SECONDS if total > 1 else 0)
        self.save_downloads()
        self.log("Job completed")

    def save_downloads(self):
        if not self.results:
            return
        df_all = pd.DataFrame(self.results)
        all_file = f"{self.job_id}_all.csv"
        self.download_files['all'] = all_file
        save_results(df_all, all_file)

        df_valid = df_all[df_all["smtp_status"] == "Valid"]
        valid_file = f"{self.job_id}_valid.csv"
        self.download_files['valid'] = valid_file
        save_results(df_valid, valid_file)

        df_undeliverable = df_all[df_all["smtp_status"] == "Invalid"]
        und_file = f"{self.job_id}_undeliverable.csv"
        self.download_files['undeliverable'] = und_file
        save_results(df_undeliverable, und_file)

    def cancel(self):
        with self.lock:
            self.is_cancelled = True
        self.log("Cancel signal received")


def run_async_job(job: Job):
    try:
        asyncio.run(job.run())
    except Exception:
        app.logger.exception('Verification job failed: %s', job.job_id)
        job.is_failed = True
        job.log('Job failed. Please try again.')
    finally:
        # Release the account only after processing and result writes have stopped.
        with jobs_lock:
            job.is_complete = True


def can_access(job):
    return job is not None and (job.user_id == g.user['id'] or g.user['role'] == 'Admin')


def start_upload(emails):
    if not isinstance(emails, list) or not emails:
        return jsonify(error='A non-empty email list is required.'), 400
    if any(not isinstance(email, str) or not email.strip() or len(email) > 254 for email in emails):
        return jsonify(error='Each email must be a non-empty string of at most 254 characters.'), 400
    with jobs_lock:
        user = find_user(g.user['id'])
        if user is None:
            return jsonify(error='Please sign in again.'), 401
        if len(emails) > user['uploadLimit']:
            return jsonify(error=f"Your upload limit is {user['uploadLimit']} emails. This upload contains {len(emails)}."), 400
        if any(job.user_id == user['id'] and not job.is_complete for job in jobs.values()):
            return jsonify(error='Your previous upload is still processing. Wait for it to finish before uploading again.'), 409
        job_id = uuid.uuid4().hex
        job = Job(job_id, emails, user['id'])
        jobs[job_id] = job
        try:
            threading.Thread(target=run_async_job, args=(job,), daemon=True).start()
        except Exception:
            del jobs[job_id]
            app.logger.exception('Could not start upload')
            return jsonify(error='Unable to start upload. Please try again.'), 503
    return jsonify(job_id=job_id)


@app.errorhandler(413)
def too_large(error):
    return jsonify(error='Upload request is too large. Maximum request size is 4 MB.'), 413


@app.get('/upload_status')
@require_user
def upload_status():
    with jobs_lock:
        active = next((job for job in jobs.values() if job.user_id == g.user['id'] and not job.is_complete), None)
    return jsonify(uploadLimit=g.user['uploadLimit'], activeJobId=active.job_id if active else None)


# Handle CORS preflight and Private Network Access for browsers (PNA)
@app.before_request
def _handle_options_preflight():
    if request.method == 'OPTIONS':
        resp = make_response()
        origin = request.headers.get('Origin')
        if origin:
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Vary'] = 'Origin'
        else:
            resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, x-api-key, Authorization'
        # If the browser requests Private Network Access, opt in explicitly
        if request.headers.get('Access-Control-Request-Private-Network'):
            resp.headers['Access-Control-Allow-Private-Network'] = 'true'
        return resp


@app.after_request
def _add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    # Ensure the client can send the API key header and content-type
    response.headers.setdefault('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization')
    response.headers.setdefault('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if request.headers.get('Access-Control-Request-Private-Network'):
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response


# -------------------------------
# Routes
# -------------------------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/start_single', methods=['POST'])
@require_api_key
def start_single():
    data = request.get_json(silent=True)
    return start_upload([data.get('email')]) if isinstance(data, dict) else (jsonify(error='Email is required.'), 400)


@app.route('/start_bulk_batch', methods=['POST'])
@require_api_key
def start_bulk_batch():
    data = request.get_json(silent=True)
    return start_upload(data.get('emails')) if isinstance(data, dict) else (jsonify(error='Emails are required.'), 400)


@app.route('/job_status/<job_id>')
@require_api_key
def job_status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not can_access(job):
        return jsonify({"error": "Job not found"}), 404
    with job.lock:
        return jsonify({
            "progress": job.progress,
            "logs": job.logs[-10:],
            "downloads": {
                "all": f"/download/{job.download_files.get('all')}" if job.download_files.get('all') else None,
                "valid": f"/download/{job.download_files.get('valid')}" if job.download_files.get('valid') else None,
                "undeliverable": f"/download/{job.download_files.get('undeliverable')}" if job.download_files.get('undeliverable') else None,
            },
            "status": ('failed' if job.is_failed else 'cancelled' if job.is_cancelled else 'completed') if job.is_complete else 'in-progress'
        })


@app.route('/cancel_job/<job_id>', methods=['POST'])
@require_api_key
def cancel_job(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not can_access(job):
        return jsonify({"error": "Job not found"}), 404
    job.cancel()
    return jsonify({"success": True})


@app.route('/download/<filename>')
@require_api_key
def download_file(filename):
    with jobs_lock:
        job = next((j for j in jobs.values() if filename in j.download_files.values()), None)
    if not can_access(job) or not job.is_complete:
        return jsonify(error='Result not found.'), 404
    try:
        return send_from_directory(RESULT_FOLDER, filename, as_attachment=True)
    except Exception:
        return "File not found", 404


# 🆕 Combine multiple batch result files into one
@app.route('/combine_results', methods=['POST'])
@require_api_key
def combine_results():
    data = request.get_json(silent=True)
    job_ids = data.get('jobIds') if isinstance(data, dict) else None
    if not isinstance(job_ids, list) or not job_ids or len(job_ids) > 100:
        return jsonify(error='Provide 1 to 100 job IDs.'), 400
    all_frames = []
    for job_id in job_ids:
        if not isinstance(job_id, str):
            return jsonify(error='Invalid job ID.'), 400
        with jobs_lock:
            job = jobs.get(job_id)
        if not can_access(job) or not job.is_complete:
            return jsonify(error='Result not found.'), 404
        path = os.path.join(RESULT_FOLDER, f"{job_id}_all.csv")
        if os.path.exists(path):
            df = pd.read_csv(path)
            df["job_id"] = job_id
            all_frames.append(df)

    if not all_frames:
        return jsonify({"error": "No result files found"}), 404

    combined = pd.concat(all_frames, ignore_index=True)
    output = io.StringIO()
    combined.to_csv(output, index=False)
    output.seek(0)

    return (
        output.getvalue(),
        200,
        {
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=combined_results.csv",
        },
    )


# -------------------------------
# Run
# -------------------------------
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
