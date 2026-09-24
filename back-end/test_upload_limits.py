import asyncio
import os
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

_directory = tempfile.TemporaryDirectory()
os.environ['ACCOUNTS_DB'] = os.path.join(_directory.name, 'accounts.sqlite3')

import app as backend
from accounts import connect, find_user


class UploadLimitTests(unittest.TestCase):
    def setUp(self):
        backend.app.config['TESTING'] = True
        backend.jobs.clear()
        self.client = backend.app.test_client()
        with backend.app.app_context(), connect() as db:
            db.execute('UPDATE users SET uploadLimit = 3 WHERE id IN (?, ?)', ('user', 'premium'))
        self.user = self.login('userurl@gmail.com', 'userul123')
        self.admin = self.login('adminurl@gmail.com', 'adminurl123')
        self.premium = self.login('premiumurl@gmail.com', 'premiumurl123')

    def login(self, email, password):
        response = self.client.post('/auth/login', json={'email': email, 'password': password})
        self.assertEqual(response.status_code, 200)
        return {'Authorization': 'Bearer ' + response.json['token']}

    def submit(self, count=3, headers=None, client=None):
        return (client or self.client).post('/start_bulk_batch',
            json={'emails': [f'person{i}@gmail.com' for i in range(count)]}, headers=headers or self.user)

    def test_rejects_oversized_without_starting_partial_job(self):
        response = self.submit(4)
        self.assertEqual(response.status_code, 400)
        self.assertIn('limit is 3', response.json['error'])
        self.assertFalse(backend.jobs)

    def test_one_upload_at_a_time_and_release(self):
        with patch.object(threading.Thread, 'start'):
            first = self.submit()
            self.assertEqual(first.status_code, 200)
            self.assertEqual(self.submit(1).status_code, 409)
            self.assertEqual(self.submit(headers=self.premium).status_code, 200)
            job = backend.jobs[first.json['job_id']]
            self.assertEqual(self.client.get('/upload_status', headers=self.user).json['activeJobId'], job.job_id)
            job.is_complete = True
            self.assertEqual(self.submit(3).status_code, 200)

    def test_single_endpoint_cannot_bypass_active_upload(self):
        with patch.object(threading.Thread, 'start'):
            self.submit()
            response = self.client.post('/start_single', json={'email': 'person@gmail.com'}, headers=self.user)
            self.assertEqual(response.status_code, 409)

    def test_cancellation_does_not_release_until_worker_exits(self):
        with patch.object(threading.Thread, 'start'):
            response = self.submit()
            job_id = response.json['job_id']
            self.client.post('/cancel_job/' + job_id, headers=self.user)
            self.assertEqual(self.submit(1).status_code, 409)
            self.assertEqual(self.client.get('/job_status/' + job_id, headers=self.user).json['status'], 'in-progress')
            backend.run_async_job(backend.jobs[job_id])
            self.assertEqual(self.client.get('/job_status/' + job_id, headers=self.user).json['status'], 'cancelled')
            self.assertEqual(self.submit(1).status_code, 200)

    def test_worker_failure_releases_user(self):
        with patch.object(threading.Thread, 'start'):
            response = self.submit()
            job = backend.jobs[response.json['job_id']]
            with patch.object(job, 'save_downloads', side_effect=OSError('disk full')):
                job.is_cancelled = True
                backend.run_async_job(job)
            self.assertTrue(job.is_complete)
            self.assertTrue(job.is_failed)
            self.assertEqual(self.submit(1).status_code, 200)

    def test_successful_completion_releases_user(self):
        async def verify(email):
            return {'input': email, 'smtp_status': 'Valid', 'status': 'Deliverable'}
        with patch.object(threading.Thread, 'start'):
            response = self.submit(1)
            job = backend.jobs[response.json['job_id']]
            with patch.object(backend, 'async_advanced_email_verify', verify), \
                 patch.object(backend, 'BULK_EMAIL_DELAY_SECONDS', 0), \
                 patch.object(job, 'save_downloads'):
                backend.run_async_job(job)
            self.assertTrue(job.is_complete)
            self.assertEqual(self.submit().status_code, 200)

    def test_concurrent_requests_only_admit_one_upload(self):
        gate = threading.Barrier(2)
        worker_threads = []
        real_start = threading.Thread.start

        def start(thread):
            if thread._target == backend.run_async_job:
                worker_threads.append(thread)
            else:
                real_start(thread)

        def submit():
            with backend.app.test_client() as client:
                gate.wait(timeout=5)
                return self.submit(1, client=client).status_code

        with patch.object(threading.Thread, 'start', start), ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(submit) for _ in range(2)]
            self.assertEqual(sorted(f.result(timeout=10) for f in futures), [200, 409])
        self.assertEqual(len(worker_threads), 1)

    def test_admin_can_create_account_with_limit_and_login(self):
        response = self.client.post('/admin/users', headers=self.admin, json={
            'username': 'newuser', 'email': 'newuser@example.com', 'password': 'test-password',
            'role': 'User', 'uploadLimit': 2})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('password_hash', response.json)
        headers = self.login('newuser@example.com', 'test-password')
        self.assertEqual(self.submit(3, headers=headers).status_code, 400)
        self.client.post('/admin/users/' + response.json['id'] + '/delete', headers=self.admin)
        self.assertEqual(self.client.get('/auth/me', headers=headers).status_code, 401)

    def test_admin_limit_edit_applies_to_existing_session(self):
        response = self.client.post('/admin/users/user', json={'uploadLimit': 1}, headers=self.admin)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.submit(2).status_code, 400)
        with backend.app.app_context():
            self.assertEqual(find_user('user')['uploadLimit'], 1)

    def test_user_cannot_edit_limits_or_impersonate(self):
        self.assertEqual(self.client.post('/admin/users/user', json={'uploadLimit': 10000}, headers=self.user).status_code, 403)
        self.assertEqual(self.client.get('/admin/users', headers=self.user).status_code, 403)
        self.assertEqual(self.client.post('/start_bulk_batch', json={'emails': ['x@gmail.com'], 'userId': 'admin'},
            headers={'x-api-key': backend.API_KEY or 'old-shared-key'}).status_code, 401)
        self.assertEqual(self.client.get('/auth/me', headers={'Authorization': 'Bearer mock-token-123'}).status_code, 401)

    def test_job_ownership(self):
        with patch.object(threading.Thread, 'start'):
            response = self.submit(1)
        job_id = response.json['job_id']
        self.assertEqual(self.client.get('/job_status/' + job_id, headers=self.premium).status_code, 404)
        self.assertEqual(self.client.post('/cancel_job/' + job_id, headers=self.premium).status_code, 404)
        self.assertEqual(self.client.get('/job_status/' + job_id, headers=self.admin).status_code, 200)
        self.assertEqual(self.client.post('/combine_results', headers=self.premium, json={'jobIds': [job_id]}).status_code, 404)

    def test_invalid_limits_and_payloads(self):
        for limit in (0, -1, 10001, True, 1.5, '100'):
            self.assertEqual(self.client.post('/admin/users/user', json={'uploadLimit': limit}, headers=self.admin).status_code, 400)
        for payload in ([], {}, {'emails': 'abc'}, {'emails': [None]}, {'emails': ['']}):
            self.assertEqual(self.client.post('/start_bulk_batch', json=payload, headers=self.user).status_code, 400)


if __name__ == '__main__':
    unittest.main()
