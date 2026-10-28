"""Real Chrome smoke test; run explicitly, separate from fast unit tests."""
import struct
from pathlib import Path
from urllib.parse import quote
from app import capture

fixture = 'data:text/html,' + quote('<!doctype html><style>body{margin:0;background:#eaf2fa}section{height:1800px}h1{margin:0;padding:30px}</style><section><h1>Screenshot API fixture</h1></section>')
out = Path('test-results')
out.mkdir(exist_ok=True)
for fmt in ('PNG', 'JPG'):
    data = capture(fixture, 800, 600, fmt, 0, False, 'http://127.0.0.1:9')
    assert data.startswith(b'\x89PNG\r\n\x1a\n' if fmt == 'PNG' else b'\xff\xd8\xff')
    if fmt == 'PNG':
        assert struct.unpack('>II', data[16:24]) == (800, 600)
    (out / ('viewport.' + fmt.lower())).write_bytes(data)
data = capture(fixture, 800, 600, 'PNG', 0, True, 'http://127.0.0.1:9')
assert struct.unpack('>II', data[16:24]) == (800, 1800)
(out / 'fullpage.png').write_bytes(data)
print('Real Chrome: PNG/JPEG signatures, 800x600 viewport and 800x1800 full-page capture passed')
