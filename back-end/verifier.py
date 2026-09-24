import re
import os
import smtplib
import dns.resolver
import logging
from email_validator import validate_email, EmailNotValidError
from difflib import get_close_matches
from functools import lru_cache
import asyncio
from concurrent.futures import ThreadPoolExecutor
import platform
import threading
import time
import random
import string

# -----------------------------------------------------
# Logging Setup
# -----------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------------------------------
# Constants / Config
# -----------------------------------------------------
DISPOSABLE_DOMAINS = {
    "mailinator.com", "10minutemail.com", "guerrillamail.com",
    "temp-mail.org", "yopmail.com", "fakeinbox.com", "trashmail.com",
    "tempmail.com", "dispostable.com", "maildrop.cc"
}

COMMON_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "icloud.com", "aol.com", "msn.com", "live.com"
]

ROLE_BASED_PARTS = {
    "admin", "info", "support", "contact", "sales", "billing",
    "help", "office", "service", "team", "webmaster", "abuse"
}

BLOCKLIST = {"baduser@example.com", "spammy@domain.com"}

SMTP_TIMEOUT = 10
RATE_LIMIT_SLEEP = 2  # seconds to pause between MX attempts
SMTP_TEMPFAIL_RETRIES = 2
SMTP_TEMPFAIL_BACKOFF_BASE = 3
PER_DOMAIN_SMTP_LIMIT = 2
_executor = ThreadPoolExecutor(max_workers=40)
_smtp_lock = threading.Lock()
_domain_semaphores = {}
_domain_semaphores_lock = threading.Lock()


def _get_domain_semaphore(domain):
    with _domain_semaphores_lock:
        semaphore = _domain_semaphores.get(domain)
        if semaphore is None:
            semaphore = threading.Semaphore(PER_DOMAIN_SMTP_LIMIT)
            _domain_semaphores[domain] = semaphore
        return semaphore

# -----------------------------------------------------
# Utility Functions
# -----------------------------------------------------
@lru_cache(maxsize=2048)
def get_mx_records(domain):
    """Return MX records for a domain."""
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        mx_records = [str(r.exchange).rstrip('.') for r in sorted(answers, key=lambda r: r.preference)]
        return True, mx_records
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return False, []

@lru_cache(maxsize=2048)
def has_a_record(domain):
    """Check if the domain has an A record."""
    try:
        answers = dns.resolver.resolve(domain, 'A')
        return bool(answers)
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return False

def is_valid_syntax(email):
    """Validate basic email syntax."""
    try:
        valid = validate_email(email, check_deliverability=False)
        return True, valid.email
    except EmailNotValidError as e:
        return False, str(e)

def is_disposable(domain):
    return domain.lower() in DISPOSABLE_DOMAINS

def is_role_based(email):
    local_part = email.split("@")[0].lower()
    return local_part in ROLE_BASED_PARTS

def suggest_typo(domain):
    if domain.lower() in COMMON_DOMAINS:
        return None
    suggestion = get_close_matches(domain, COMMON_DOMAINS, n=1, cutoff=0.8)
    return suggestion[0] if suggestion else None

# -----------------------------------------------------
# MX Direct SMTP Verification
# -----------------------------------------------------
def _smtp_text(reply):
    return reply.decode('utf-8', errors='replace') if isinstance(reply, bytes) else str(reply)


def _missing_mailbox(code, reply):
    # A generic 550 can reject the sender or its policy, not the mailbox.
    return 500 <= code < 600 and re.match(r'^5\.1\.1(?:\s|$)', _smtp_text(reply).strip()) is not None


def verify_via_mx(email, mx_records):
    """
    Verify email by connecting directly to MX servers (port 25).
    Includes accept-all detection.
    """
    domain = email.split("@", 1)[1].lower()
    semaphore = _get_domain_semaphore(domain)
    failures = []
    saw_tempfail = False
    sender = os.getenv('SMTP_MAIL_FROM', '')
    helo = os.getenv('SMTP_HELO_HOSTNAME') or None
    for mx in mx_records:
        for attempt in range(SMTP_TEMPFAIL_RETRIES + 1):
            tempfail = False
            server = None
            stage = 'connect'
            with semaphore:
                try:
                    server = smtplib.SMTP(mx, 25, timeout=SMTP_TIMEOUT, local_hostname=helo)
                    stage = 'HELO'
                    server.ehlo_or_helo_if_needed()
                    stage = 'MAIL FROM'
                    code, reply = server.mail(sender)
                    if code != 250:
                        raise smtplib.SMTPResponseException(code, reply)

                    # Check the target email
                    stage = 'RCPT TO'
                    code, reply = server.rcpt(email)
                    detail = f'{mx}: {stage} {code} {_smtp_text(reply)}'
                    if _missing_mailbox(code, reply):
                        return 'Invalid', detail
                    if code not in (250, 251):
                        raise smtplib.SMTPResponseException(code, reply)

                    # Catch-all detection
                    stage = 'catch-all RSET'
                    reset_code, reset_reply = server.rset()
                    if reset_code != 250:
                        raise smtplib.SMTPResponseException(reset_code, reset_reply)
                    stage = 'catch-all MAIL FROM'
                    mail_code, mail_reply = server.mail(sender)
                    if mail_code != 250:
                        raise smtplib.SMTPResponseException(mail_code, mail_reply)
                    random_local = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
                    random_email = f"{random_local}@{domain}"
                    stage = 'catch-all RCPT TO'
                    random_code, random_reply = server.rcpt(random_email)

                    if random_code in (250, 251):
                        return "Inconclusive", f"{mx} (Catch-All detected)"
                    if _missing_mailbox(random_code, random_reply):
                        return "Valid", detail
                    raise smtplib.SMTPResponseException(random_code, random_reply)

                except smtplib.SMTPResponseException as e:
                    tempfail = 400 <= e.smtp_code < 500
                    saw_tempfail = saw_tempfail or tempfail
                    failures.append(f'{mx}: {stage} {e.smtp_code} {_smtp_text(e.smtp_error)}')
                    logger.warning('%s', failures[-1])
                except (OSError, smtplib.SMTPException) as e:
                    failures.append(f'{mx}: {stage} {type(e).__name__}: {e}')
                    logger.warning('%s', failures[-1])
                finally:
                    if server is not None:
                        try:
                            server.quit()
                        except Exception:
                            server.close()

            time.sleep(RATE_LIMIT_SLEEP)

            if tempfail:
                if attempt < SMTP_TEMPFAIL_RETRIES:
                    time.sleep(SMTP_TEMPFAIL_BACKOFF_BASE * (attempt + 1))
                    continue
            break

    return ('TempFail' if saw_tempfail else 'Unverifiable'), '; '.join(failures) or 'No MX servers available'

# -----------------------------------------------------
# Main Verification Logic
# -----------------------------------------------------
def advanced_email_verify(email):
    result = {"input": email, "smtp_status": "NotChecked"}

    # Step 1: Syntax
    valid_syntax, validated_or_error = is_valid_syntax(email)
    if not valid_syntax:
        result.update({"status": "Invalid Syntax", "valid_syntax": False, "score": 0})
        return result

    email = validated_or_error
    domain = email.split("@")[1].lower()

    # Step 2: Domain-level checks
    result["valid_syntax"] = True
    result["domain"] = domain
    result["is_disposable"] = is_disposable(domain)
    result["is_role_based"] = is_role_based(email)
    result["is_blocked"] = email.lower() in BLOCKLIST
    result["is_suspicious"] = bool(re.search(r'\d{5,}', email.split("@")[0]))
    result["typo_suggestion"] = suggest_typo(domain)

    # Step 3: MX record lookup
    try:
        has_mx, mx_records = get_mx_records(domain)
        if not has_mx:
            if not has_a_record(domain):
                result.update({"status": "No MX or A Record", "score": 5})
                return result
            mx_records = [domain]
    except dns.exception.DNSException as e:
        result.update({"status": "Unknown / Unverifiable", "score": None,
                       "checked_with_smtp": f'DNS lookup failed: {type(e).__name__}: {e}'})
        return result

    if mx_records == ['']:
        result.update({"status": "Domain Does Not Accept Email", "score": 0})
        return result

    result["mx_records"] = mx_records

    # Step 4: SMTP check via MX
    smtp_status, used_server = verify_via_mx(email, mx_records)
    result["smtp_status"] = smtp_status
    result["checked_with_smtp"] = used_server

    # Step 5: Scoring
    score = 100
    if result["is_disposable"]:
        score -= 20
    if result["is_blocked"]:
        score -= 50
    if result["is_role_based"]:
        score -= 10
    if result["is_suspicious"]:
        score -= 15
    if smtp_status not in ("Valid", "Inconclusive"):
        score -= 50

    result["score"] = max(0, score)
    result["score_basis"] = "Heuristic quality score, not mailbox confirmation or a delivery probability"
    if smtp_status in ('Unverifiable', 'TempFail'):
        result["score"] = None

    if smtp_status == "Valid":
        result["status"] = "Deliverable"
    elif smtp_status == "Inconclusive":
        result["status"] = "Catch-All / Unverified"
    elif smtp_status == "TempFail":
        result["status"] = "Temporary Issue"
    elif smtp_status == "Invalid":
        result["status"] = "Undeliverable"
    else:
        result["status"] = "Unknown / Unverifiable"

    return result

# -----------------------------------------------------
# Async Wrapper
# -----------------------------------------------------
async def async_advanced_email_verify(email):
    loop = asyncio.get_event_loop()
    advanced_task = loop.run_in_executor(_executor, advanced_email_verify, email)
    return await advanced_task
