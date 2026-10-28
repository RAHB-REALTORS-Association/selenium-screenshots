"""Bound the complete browser lifetime and keep API credentials out of its environment."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

from werkzeug.exceptions import HTTPException, GatewayTimeout


def run_capture(*arguments):
    # Browser children need no API credentials or deployment secrets.
    allowed = {'PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'CHROME_BIN',
               'CHROMEDRIVER_BIN', 'BROWSER_SOFTWARE_HEVC', 'SE_AVOID_STATS'}
    environment = {key: value for key, value in os.environ.items() if key in allowed}
    process = subprocess.Popen(
        [sys.executable, str(Path(__file__).with_name('capture_worker.py'))],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env=environment, start_new_session=True)
    try:
        output, errors = process.communicate(json.dumps(arguments).encode(), timeout=55)
        if process.returncode:
            try:
                details = json.loads(errors.decode())
                code, message = details['code'], details['message']
            except (ValueError, KeyError, UnicodeError):
                code, message = 502, 'Capture failed'
            error = HTTPException(description=message)
            error.code = code
            raise error
        return output
    except subprocess.TimeoutExpired:
        raise GatewayTimeout('Capture exceeded its 55-second deadline') from None
    finally:
        # Also reap Chrome/driver descendants after success or failure.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.communicate()
