# Per-user upload limits

## Browser tabs

Only one VeriFast tab runs per origin in the same browser profile. Other tabs
show "Already open in another tab" and do not mount login, dashboards or job
polling. Close the active tab, then select Try Again in the blocked tab.
The browser releases the lock when its owning tab closes or crashes. Refreshing
the active tab reacquires it; simultaneous contenders cannot both acquire it.
This requires Web Locks on HTTPS (or localhost for development). Separate
browser profiles/devices do not share this browser lock; backend upload limits
still apply to the account across those sessions.

Deploy the backend and frontend together. Frontend-only mock login and the shared
API key no longer authorize verification requests. Users must sign in again.
The three existing login accounts are migrated once into the backend database;
accounts previously added only to the browser's mock list must be created again.

In Admin > User Management, set Maximum emails per upload when adding or editing
a user. New users require a password. The default is 1,000; the supported range
is 1 to 10,000 emails. The upper bound is an application guardrail, not a measured
server capacity. Admins can change a password in Edit User.

Each account can run one upload (or single-email check) at a time. The server
rejects oversized uploads before creating a job and rejects additional uploads
while a job is active. Cancellation releases the account only after the current
verification stops. A limit change applies to future submissions; it does not
interrupt an already accepted upload. Limits apply to admins too.

Bulk files now produce one job instead of starting every 100-email batch at once.
The browser deduplicates extracted addresses; the backend counts submitted list
entries, so duplicate entries cannot bypass the limit. Files are capped at 10 MB
in the browser and JSON requests at 4 MB on the backend.

## Docker

```sh
docker compose up -d --build backend frontend
```

If deploying prebuilt images, rebuild/push both images and recreate both services.
Keep the database volume in the VPS configuration:

```yaml
volumes:
  - ./back-end/data:/app/data
```

The database contains accounts, password hashes, limits and the session-signing
secret. Preserve and back up this directory; do not include a local database in a
published image. Sessions expire after 24 hours. Change the existing demo
passwords in User Management for a public deployment.

## Worker lifecycle

Run one backend process/container with threads, as in the current Docker setup.
Admission is atomic under that process's jobs lock. Multiple workers or replicas
require a shared job queue and distributed admission control before scaling.
Accounts and limits survive restarts. Running jobs and their ownership metadata
are still in memory: a restart ends processing, releases active slots and makes
old result downloads unavailable through the API. Let active jobs finish before
restarting. This change does not add persistent job execution or history.

## Verification

```sh
cd back-end
python -m unittest test_upload_limits test_verifier -v
```

Tests use a temporary account database and mocked SMTP/worker execution.
