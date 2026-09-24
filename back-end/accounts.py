import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from functools import wraps
from contextlib import contextmanager

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


accounts = Blueprint('accounts', __name__)
DEFAULT_UPLOAD_LIMIT = 1000
MAX_UPLOAD_LIMIT = 10000


@contextmanager
def connect():
    db = sqlite3.connect(current_app.config['ACCOUNTS_DB'], timeout=15)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def public_user(row):
    return {key: row[key] for key in ('id', 'username', 'email', 'role', 'createdAt', 'uploadLimit')}


def init_accounts(app):
    app.config['ACCOUNTS_DB'] = os.getenv('ACCOUNTS_DB', 'data/accounts.sqlite3')
    os.makedirs(os.path.dirname(os.path.abspath(app.config['ACCOUNTS_DB'])), exist_ok=True)
    with app.app_context(), connect() as db:
        db.execute('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)')
        db.execute('INSERT OR IGNORE INTO settings VALUES (?, ?)', ('session_secret', secrets.token_hex(32)))
        app.config['SESSION_SIGNER'] = URLSafeTimedSerializer(
            db.execute('SELECT value FROM settings WHERE name = ?', ('session_secret',)).fetchone()[0],
            salt='verifast-login')
        db.execute('''CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL, password_hash TEXT NOT NULL, createdAt TEXT NOT NULL,
            uploadLimit INTEGER NOT NULL CHECK(uploadLimit BETWEEN 1 AND 10000))''')
        # Migrate the existing demo logins once, without restoring deleted accounts.
        if not db.execute("SELECT 1 FROM settings WHERE name = 'accounts_initialized'").fetchone():
            for username, email, password, role in (
                ('admin', 'adminurl@gmail.com', 'adminurl123', 'Admin'),
                ('premium', 'premiumurl@gmail.com', 'premiumurl123', 'Premium'),
                ('user', 'userurl@gmail.com', 'userul123', 'User'),
            ):
                db.execute('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)', (
                    username, username, email, role, generate_password_hash(password),
                    datetime.now(timezone.utc).isoformat(), DEFAULT_UPLOAD_LIMIT))
            db.execute("INSERT INTO settings VALUES ('accounts_initialized', '1')")
    app.register_blueprint(accounts)


def find_user(user_id):
    with connect() as db:
        return db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def require_user(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        token = request.headers.get('Authorization', '').removeprefix('Bearer ')
        try:
            user_id = current_app.config['SESSION_SIGNER'].loads(token, max_age=86400)
        except (BadSignature, SignatureExpired):
            return jsonify(error='Please sign in again.'), 401
        g.user = find_user(user_id)
        if g.user is None:
            return jsonify(error='Please sign in again.'), 401
        return fn(*args, **kwargs)
    return wrapped


def require_admin(fn):
    @wraps(fn)
    @require_user
    def wrapped(*args, **kwargs):
        if g.user['role'] != 'Admin':
            return jsonify(error='Administrator access required.'), 403
        return fn(*args, **kwargs)
    return wrapped


@accounts.post('/auth/login')
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('email'), str) or not isinstance(data.get('password'), str):
        return jsonify(error='Email and password are required.'), 400
    with connect() as db:
        row = db.execute('SELECT * FROM users WHERE email = ?', (data['email'].strip().lower(),)).fetchone()
    if row is None or not check_password_hash(row['password_hash'], data['password']):
        return jsonify(error='Invalid email or password.'), 401
    return jsonify(user=public_user(row), token=current_app.config['SESSION_SIGNER'].dumps(row['id']))


@accounts.get('/auth/me')
@require_user
def me():
    return jsonify(public_user(g.user))


@accounts.get('/admin/users')
@require_admin
def list_users():
    with connect() as db:
        return jsonify([public_user(row) for row in db.execute('SELECT * FROM users ORDER BY createdAt DESC')])


@accounts.route('/admin/users', methods=['POST'])
@accounts.route('/admin/users/<user_id>', methods=['POST'])
@require_admin
def save_user(user_id=None):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error='User details are required.'), 400
    existing = find_user(user_id) if user_id else None
    if user_id and existing is None:
        return jsonify(error='User not found.'), 404
    values = dict(existing) if existing else {'role': 'User', 'uploadLimit': DEFAULT_UPLOAD_LIMIT}
    values.update({key: data[key] for key in ('username', 'email', 'role', 'uploadLimit') if key in data})
    limit = values['uploadLimit']
    if type(limit) is not int or not 1 <= limit <= MAX_UPLOAD_LIMIT:
        return jsonify(error=f'Upload limit must be a whole number from 1 to {MAX_UPLOAD_LIMIT}.'), 400
    if values['role'] not in ('Admin', 'Premium', 'User'):
        return jsonify(error='Invalid role.'), 400
    if any(not isinstance(values.get(k), str) or not values[k].strip() for k in ('username', 'email')):
        return jsonify(error='Username and email are required.'), 400
    if '@' not in values['email'] or len(values['email']) > 254 or len(values['username']) > 100:
        return jsonify(error='Invalid username or email.'), 400
    if user_id == g.user['id'] and values['role'] != 'Admin':
        return jsonify(error='You cannot change your own admin role.'), 400
    password = data.get('password')
    if not existing or password:
        if not isinstance(password, str) or not 8 <= len(password) <= 256:
            return jsonify(error='Password must contain 8 to 256 characters.'), 400
        password_hash = generate_password_hash(password)
    else:
        password_hash = existing['password_hash']
    user_id = user_id or uuid.uuid4().hex
    try:
        with connect() as db:
            db.execute('''INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET username=excluded.username, email=excluded.email,
                role=excluded.role, password_hash=excluded.password_hash, uploadLimit=excluded.uploadLimit''', (
                user_id, values['username'].strip(), values['email'].strip().lower(), values['role'],
                password_hash, existing['createdAt'] if existing else datetime.now(timezone.utc).isoformat(), limit))
    except sqlite3.IntegrityError:
        return jsonify(error='An account already uses that email.'), 409
    return jsonify(public_user(find_user(user_id)))


@accounts.post('/admin/users/<user_id>/delete')
@require_admin
def delete_user(user_id):
    if user_id == g.user['id']:
        return jsonify(error='You cannot delete your own account.'), 400
    with connect() as db:
        db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    return jsonify(success=True)
