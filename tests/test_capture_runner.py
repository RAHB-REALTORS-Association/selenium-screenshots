import os
import subprocess
import unittest
from unittest.mock import patch
from werkzeug.exceptions import GatewayTimeout
from capture_runner import run_capture


class RunnerTests(unittest.TestCase):
    def test_timeout_kills_browser_group_and_strips_credentials(self):
        with patch.dict(os.environ, {'BEARER_TOKEN': 'private', 'COOLIFY_TOKEN': 'private'}), \
                patch('capture_runner.subprocess.Popen') as popen, patch('capture_runner.os.killpg') as kill:
            process = popen.return_value
            process.pid = 123
            process.communicate.side_effect = [subprocess.TimeoutExpired('capture', 55), (b'', b'')]
            with self.assertRaises(GatewayTimeout):
                run_capture('https://example.com', 800, 600, 'PNG', 0, False, 'http://proxy:3128')
            kill.assert_called_once()
            environment = popen.call_args.kwargs['env']
            self.assertNotIn('BEARER_TOKEN', environment)
            self.assertNotIn('COOLIFY_TOKEN', environment)
