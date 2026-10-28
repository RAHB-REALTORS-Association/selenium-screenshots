"""Verify overload rejection through the real production Gunicorn worker configuration."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]


def request(path):
    req = Request(f'http://127.0.0.1:{port}{path}', headers={'Authorization': 'Bearer capacity-test'})
    try:
        with urlopen(req, timeout=8) as response:
            return response.status, response.headers.get('Retry-After')
    except HTTPError as error:
        return error.code, error.headers.get('Retry-After')


with TemporaryDirectory() as directory:
    env = dict(os.environ, BEARER_TOKEN='capacity-test', SCREENSHOT_PROXY='http://proxy:3128', CAPACITY_FIXTURE_DIR=directory)
    process = subprocess.Popen([sys.executable, '-m', 'gunicorn', '-c', 'gunicorn_config.py',
                                '--bind', f'127.0.0.1:{port}', '--pythonpath', 'tests', 'capacity_fixture:app'],
                               env=env, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.monotonic() + 10
        while True:
            try:
                assert request('/health')[0] == 200
                break
            except URLError:
                assert time.monotonic() < deadline, 'Gunicorn failed to start'
                time.sleep(.05)
        with ThreadPoolExecutor(max_workers=2) as pool:
            active = [pool.submit(request, '/screenshot?url=https://example.com') for _ in range(2)]
            deadline = time.monotonic() + 5
            while len(list(Path(directory).iterdir())) < 2:
                assert time.monotonic() < deadline, 'Captures failed to occupy both slots'
                time.sleep(.02)
            started = time.monotonic()
            assert request('/screenshot?url=https://example.com') == (503, '5')
            assert time.monotonic() - started < 1, 'Overload was queued instead of rejected'
            assert all(result.result()[0] == 200 for result in active)
        assert request('/screenshot?url=https://example.com')[0] == 200
        print('Production Gunicorn: two active captures, immediate 503/Retry-After, capacity recovered')
    finally:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
