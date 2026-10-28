"""Supervise the local socket relay and API together when running the Compose stack."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def main():
    command = sys.argv[1:]
    proxy_socket = os.environ.get('EGRESS_PROXY_SOCKET')
    if not proxy_socket:
        os.execvp(command[0], command)
    stopping = False

    def stop(signum, frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    allowed = {'PATH', 'HOME', 'LANG', 'LC_ALL'}
    environment = {key: value for key, value in os.environ.items() if key in allowed}
    relay = subprocess.Popen([sys.executable, str(Path(__file__).with_name('socket_proxy.py')), '--socket', proxy_socket], env=environment)
    api = subprocess.Popen(command)
    children = [relay, api]
    try:
        while not stopping and all(child.poll() is None for child in children):
            time.sleep(.2)
        return 0 if stopping else 1
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 60
        for child in children:
            try:
                child.wait(timeout=max(.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == '__main__':
    sys.exit(main())
