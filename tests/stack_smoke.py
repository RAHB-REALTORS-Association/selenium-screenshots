"""Exercise real HTTP capture and denied direct egress through the complete Compose stack."""
import json
import os
from pathlib import Path
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from png_pixels import png_rgb

environment = dict(os.environ, BEARER_TOKEN='stack-test-token', API_IMAGE='screenshot-api:ci',
                   PROXY_IMAGE='screenshot-proxy:ci', GATEWAY_IMAGE='screenshot-gateway:ci', ALLOW_PRIVATE_TARGETS='false')
compose = ['docker', 'compose', '-p', 'screenshot-stack-test', '-f', 'compose.yaml', '-f', 'tests/compose.test.yaml']


def run(*arguments, capture=False):
    return subprocess.run([*compose, *arguments], env=environment, check=True,
                          stdout=subprocess.PIPE if capture else None, text=capture).stdout


try:
    run('up', '-d', '--wait', '--wait-timeout', '120')
    api_id = run('ps', '-q', 'api', capture=True).strip()
    details = json.loads(subprocess.check_output(['docker', 'inspect', api_id]))[0]
    assert details['HostConfig']['NetworkMode'] == 'none', 'Capture container unexpectedly has network access'
    run('exec', '-T', 'api', 'python', '-c', '''
import socket
for target in ('1.1.1.1', '169.254.169.254'):
    try:
        socket.create_connection((target, 443), timeout=1)
    except OSError:
        pass
    else:
        raise AssertionError('Direct egress is reachable: ' + target)
print('Direct public and metadata TCP access is blocked')
''')
    port = run('port', 'gateway', '8080', capture=True).strip().rsplit(':', 1)[1]
    base = f'http://127.0.0.1:{port}'
    try:
        urlopen(base + '/screenshot?url=https://example.com')
        raise AssertionError('Unauthenticated capture succeeded')
    except HTTPError as error:
        assert error.code == 401
    policy = '''
from urllib.request import ProxyHandler, build_opener
from urllib.error import HTTPError
opener = build_opener(ProxyHandler({'http': 'http://127.0.0.1:3128'}))
for url in ('http://fixture/', 'http://169.254.169.254/'):
    try:
        opener.open(url, timeout=5)
    except HTTPError as error:
        assert error.code == 403
    else:
        raise AssertionError('Private destination was reachable by default')
print('Filtering proxy denies private hostnames and metadata over the Unix relay')
'''
    run('exec', '-T', 'api', 'python', '-c', policy)
    environment['ALLOW_PRIVATE_TARGETS'] = 'true'
    run('up', '-d', '--wait', '--wait-timeout', '120')
    parameters = urlencode({'url': 'http://fixture/capture.html', 'viewport': '800x600'})
    request = Request(base + '/screenshot?' + parameters, headers={'Authorization': 'Bearer stack-test-token'})
    with urlopen(request, timeout=60) as response:
        assert response.headers['Content-Type'] == 'image/png'
        data = response.read()
    assert data.startswith(b'\x89PNG\r\n\x1a\n')
    r, g, b = png_rgb(data)
    assert g > 90 and r < 40 and b < 80, f'HEVC pixels missing through the stack: {r,g,b}'
    Path('test-results').mkdir(exist_ok=True)
    Path('test-results/compose-capture.png').write_bytes(data)
    print('Gateway -> API Unix socket -> browser -> proxy Unix socket -> fixture: HEVC pixels verified')
except Exception:
    run('logs', '--tail', '40')
    raise
finally:
    run('down', '--volumes', '--remove-orphans')
