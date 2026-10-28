"""Real Chrome smoke test; run explicitly, separate from fast unit tests."""
import struct
from pathlib import Path
from urllib.parse import quote
from app import capture

def png_rgb(data, pixel_x=10, pixel_y=10):
    import zlib
    chunks = bytearray()
    pos = 8
    while pos < len(data):
        length = int.from_bytes(data[pos:pos+4], 'big')
        kind = data[pos+4:pos+8]
        if kind == b'IDAT': chunks.extend(data[pos+8:pos+8+length])
        pos += length + 12
    width = int.from_bytes(data[16:20], 'big')
    assert data[24] == 8 and data[25] in (2, 6)
    channels = 3 if data[25] == 2 else 4
    stride = width * channels
    raw = zlib.decompress(chunks)
    previous = bytearray(stride)
    for y in range(pixel_y + 1):
        offset = y * (stride + 1)
        mode = raw[offset]
        row = bytearray(raw[offset+1:offset+1+stride])
        for x in range(stride):
            a = row[x-channels] if x >= channels else 0
            b = previous[x]
            c = previous[x-channels] if x >= channels else 0
            p = a + b - c
            pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
            paeth = a if pa <= pb and pa <= pc else b if pb <= pc else c
            predictor = (0, a, b, (a+b)//2, paeth)[mode]
            row[x] = (row[x] + predictor) & 255
        previous = row
    return tuple(row[pixel_x*channels:pixel_x*channels+3])

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

# The page has loaded before its canvas and JS-rendered content appear.
dynamic_fixture = 'data:text/html,' + quote('''<!doctype html><style>body{margin:0}canvas{display:block}</style><canvas id="hero" width="800" height="300"></canvas><div id="demo"></div><script>setTimeout(()=>{let c=document.getElementById('hero').getContext('2d');c.fillStyle='#137333';c.fillRect(0,0,800,300);c.fillStyle='white';c.font='32px sans-serif';c.fillText('Canvas introduction loaded',40,150);document.getElementById('demo').textContent='Delayed product demo loaded';},2500);</script>''')
data = capture(dynamic_fixture, 800, 600, 'PNG', 0, False, 'http://127.0.0.1:9')
(out / 'render-readiness.png').write_bytes(data)
assert png_rgb(data) == (19,115,51), 'Captured blank canvas before delayed rendering'
print('Delayed canvas pixels verified in the captured PNG')

import base64
video_data = base64.b64encode(Path('tests/fixtures/green-hevc.mp4').read_bytes()).decode()
video_fixture = 'data:text/html,' + quote('<!doctype html><style>body{margin:0}</style><video autoplay muted loop playsinline width="320" height="180" src="data:video/mp4;base64,' + video_data + '"></video>')
data = capture(video_fixture, 800, 600, 'PNG', 0, False, 'http://127.0.0.1:9')
(out / 'hevc-rendering.png').write_bytes(data)
r,g,b = png_rgb(data)
assert g > 90 and r < 40 and b < 80, f'HEVC video did not render: {r,g,b}'
print('HEVC video pixels verified in the captured PNG')
