"""Controlled slow capture for exercising the production Gunicorn admission policy."""
import os
from pathlib import Path
import threading
import time

from app import app
import capture_runner


def slow_capture(*arguments):
    marker = Path(os.environ['CAPACITY_FIXTURE_DIR']) / f'{os.getpid()}-{threading.get_ident()}'
    marker.touch()
    try:
        time.sleep(3)
        return b'image'
    finally:
        marker.unlink()


capture_runner.run_capture = slow_capture
