import smtplib
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import dns.exception
import verifier


class VerifierTests(unittest.TestCase):
    def setUp(self):
        self.smtp_patch = patch('verifier.smtplib.SMTP')
        self.smtp = self.smtp_patch.start()
        self.addCleanup(self.smtp_patch.stop)
        self.sleep_patch = patch('verifier.time.sleep')
        self.sleep_patch.start()
        self.addCleanup(self.sleep_patch.stop)
        self.server = self.smtp.return_value
        self.server.mail.return_value = (250, b'OK')
        self.server.rset.return_value = (250, b'OK')

    def check(self):
        return verifier.verify_via_mx('person@gmail.com', ['mx.test'])

    def test_acceptance_with_rejected_random_recipient(self):
        self.server.rcpt.side_effect = [(250, b'OK'), (550, b'5.1.1 Unknown user')]
        self.assertEqual(self.check()[0], 'Valid')

    def test_policy_rejection_is_unknown(self):
        self.server.rcpt.return_value = (550, b'5.7.1 IP blocked')
        status, detail = self.check()
        self.assertEqual(status, 'Unverifiable')
        self.assertIn('5.7.1 IP blocked', detail)
        self.assertEqual(self.server.rcpt.call_count, 1)

    def test_explicit_missing_mailbox(self):
        self.server.rcpt.return_value = (550, b'5.1.1 Unknown user')
        self.assertEqual(self.check()[0], 'Invalid')
        self.assertEqual(self.server.rcpt.call_count, 1)

    def test_sender_rejection_does_not_reject_recipient(self):
        self.server.mail.return_value = (550, b'5.1.1 Sender not found')
        self.assertEqual(self.check()[0], 'Unverifiable')
        self.server.rcpt.assert_not_called()

    def test_timeout_is_preserved(self):
        self.smtp.side_effect = TimeoutError('connection timed out')
        status, detail = self.check()
        self.assertEqual(status, 'Unverifiable')
        self.assertIn('connect TimeoutError', detail)

    def test_catch_all(self):
        self.server.rcpt.return_value = (250, b'OK')
        self.assertEqual(self.check()[0], 'Inconclusive')

    def test_random_recipient_policy_failure_is_not_valid(self):
        self.server.rcpt.side_effect = [(250, b'OK'), (550, b'5.7.1 Blocked')]
        self.assertEqual(self.check()[0], 'Unverifiable')

    def test_tempfail_tries_next_mx(self):
        self.server.rcpt.return_value = (451, b'4.7.1 Try later')
        second = MagicMock()
        second.mail.return_value = (250, b'OK')
        second.rset.return_value = (250, b'OK')
        second.rcpt.side_effect = [(250, b'OK'), (550, b'5.1.1 Unknown')]
        self.smtp.side_effect = [self.server] * 3 + [second]
        self.assertEqual(verifier.verify_via_mx('person@gmail.com', ['one', 'two'])[0], 'Valid')

    def test_unresolved_score_is_not_probability(self):
        with patch('verifier.get_mx_records', return_value=(True, ['mx.test'])):
            self.smtp.side_effect = TimeoutError('timed out')
            result = verifier.advanced_email_verify('person@gmail.com')
        self.assertIsNone(result['score'])
        self.assertIsNone(result['typo_suggestion'])

    def test_dns_timeout_is_unknown(self):
        with patch('verifier.get_mx_records', side_effect=dns.exception.Timeout):
            result = verifier.advanced_email_verify('person@gmail.com')
        self.assertEqual(result['status'], 'Unknown / Unverifiable')
        self.smtp.assert_not_called()

    def test_catch_all_has_quality_score_but_remains_unverified(self):
        with patch('verifier.get_mx_records', return_value=(True, ['mx.test'])):
            self.server.rcpt.return_value = (250, b'OK')
            result = verifier.advanced_email_verify('shanmugam.d@urlfactory.in')
        self.assertEqual(result['score'], 100)
        self.assertFalse(result['is_suspicious'])
        self.assertEqual(result['smtp_status'], 'Inconclusive')
        self.assertEqual(result['status'], 'Catch-All / Unverified')
        self.assertIn('not mailbox confirmation', result['score_basis'])

    def test_verified_long_name_is_not_penalized(self):
        with patch('verifier.get_mx_records', return_value=(True, ['mx.test'])):
            self.server.rcpt.side_effect = [(250, b'OK'), (550, b'5.1.1 Unknown')]
            result = verifier.advanced_email_verify('shanmugamdevaraj4@gmail.com')
        self.assertEqual(result['score'], 100)
        self.assertFalse(result['is_suspicious'])
        self.assertEqual(result['status'], 'Deliverable')

    def test_catch_all_retains_other_quality_penalties(self):
        with patch('verifier.get_mx_records', return_value=(True, ['mx.test'])):
            self.server.rcpt.return_value = (250, b'OK')
            result = verifier.advanced_email_verify('person12345@mailinator.com')
        self.assertEqual(result['score'], 65)
        self.assertTrue(result['is_suspicious'])
        self.assertTrue(result['is_disposable'])
        self.assertEqual(result['smtp_status'], 'Inconclusive')

    def test_mx_priority(self):
        verifier.get_mx_records.cache_clear()
        self.addCleanup(verifier.get_mx_records.cache_clear)
        answers = [SimpleNamespace(preference=20, exchange='a.test.'),
                   SimpleNamespace(preference=5, exchange='z.test.')]
        with patch('verifier.dns.resolver.resolve', return_value=answers):
            self.assertEqual(verifier.get_mx_records('gmail.com'), (True, ['z.test', 'a.test']))

    def test_null_mx_does_not_connect(self):
        with patch('verifier.get_mx_records', return_value=(True, [''])):
            result = verifier.advanced_email_verify('person@gmail.com')
        self.assertEqual(result['status'], 'Domain Does Not Accept Email')
        self.smtp.assert_not_called()


if __name__ == '__main__':
    unittest.main()
