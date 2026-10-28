"""Screenshot service."""
import hmac
import ipaddress
import os
import re
from multiprocessing import BoundedSemaphore
from urllib.parse import urlsplit

from flask import Flask, Response, abort, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from rendering import RenderError, wait_for_render

app = Flask(__name__)
capture_slots = BoundedSemaphore(2)  # Shared across Gunicorn's preloaded workers.
CORS(app, origins=os.environ.get('ALLOWED_ORIGINS', 'https://screenshots.oncornerstone.app').split(','))


def settings():
    token = os.environ.get('BEARER_TOKEN', '')
    proxy = os.environ.get('SCREENSHOT_PROXY', '')
    private_targets_allowed()
    if not token or not proxy:
        raise RuntimeError('BEARER_TOKEN and SCREENSHOT_PROXY must be configured')
    parsed = urlsplit(proxy)
    if parsed.scheme != 'http' or not parsed.hostname or not parsed.port or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise RuntimeError('SCREENSHOT_PROXY must be an http proxy URL with a host and port')
    return token, proxy


def private_targets_allowed():
    value = os.environ.get('ALLOW_PRIVATE_TARGETS', 'false').lower()
    if value not in ('true', 'false'):
        raise RuntimeError('ALLOW_PRIVATE_TARGETS must be true or false')
    return value == 'true'


def capture(url, width, height, image_format, delay, fullpage, proxy):
    options = Options()
    for argument in ('--headless=new', '--hide-scrollbars', '--disable-dev-shm-usage',
                     '--disable-quic', f'--proxy-server={proxy}',
                     '--proxy-bypass-list=<-loopback>', f'--window-size={width},{height}'):
        options.add_argument(argument)
    if os.environ.get('BROWSER_SOFTWARE_HEVC') == '1':
        options.add_argument('--enable-features=FFmpegSoftwareHEVCDecoder')
    if os.environ.get('CHROME_BIN'):
        options.binary_location = os.environ['CHROME_BIN']
    # Selenium Manager discovers local Chrome and a matching driver on macOS.
    service = Service(os.environ['CHROMEDRIVER_BIN']) if os.environ.get('CHROMEDRIVER_BIN') else Service()
    driver = webdriver.Chrome(service=service, options=options)
    try:
        driver.set_page_load_timeout(25)
        driver.set_script_timeout(10)
        driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False})
        driver.get(url)
        if delay:
            import time
            time.sleep(delay)
        wait_for_render(driver)
        params = {'format': 'jpeg' if image_format == 'JPG' else 'png', 'captureBeyondViewport': fullpage}
        if fullpage:
            dimensions = driver.execute_script('return [document.documentElement.scrollWidth, document.documentElement.scrollHeight]')
            if dimensions[0] * dimensions[1] > 16000000 or max(dimensions) > 10000:
                abort(400, 'Full page exceeds capture size limit')
            params['clip'] = {'x': 0, 'y': 0, 'width': dimensions[0], 'height': dimensions[1], 'scale': 1}
        import base64
        return base64.b64decode(driver.execute_cdp_cmd('Page.captureScreenshot', params)['data'])
    finally:
        driver.quit()


@app.errorhandler(HTTPException)
def http_error(error):
    return jsonify(message=error.description, error=error.name), error.code


@app.get('/health')
def health():
    try:
        settings()
    except (RuntimeError, ValueError):
        return jsonify(status='unavailable'), 503
    return jsonify(status='ok')


@app.get('/screenshot')
@app.get('/api/capture')
def screenshot():
    try:
        token, proxy = settings()
    except (RuntimeError, ValueError):
        app.logger.error('Screenshot service configuration is invalid')
        abort(503, 'Service configuration is invalid')
    if not hmac.compare_digest(request.headers.get('Authorization', '').encode(), ('Bearer ' + token).encode()):
        abort(401)
    url = request.args.get('url', '')
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.port == 0:
            raise ValueError()
        try:
            address = ipaddress.ip_address(parsed.hostname)
        except ValueError:
            address = None  # The egress proxy resolves and filters hostnames.
        internal = address is not None and address.version == 4 and any(address in network for network in (
            ipaddress.ip_network('10.0.0.0/8'), ipaddress.ip_network('172.16.0.0/12'), ipaddress.ip_network('192.168.0.0/16')))
        if address is not None and not address.is_global and not (private_targets_allowed() and internal):
            raise ValueError()
    except ValueError:
        abort(400, 'Invalid URL')
    match = re.fullmatch(r'(\d{1,4})x(\d{1,4})', request.args.get('viewport', '1440x900'))
    if not match:
        abort(400, 'Invalid viewport')
    width, height = map(int, match.groups())
    if not width or not height or width * height > 16000000:
        abort(400, 'Invalid viewport dimensions')
    image_format = request.args.get('format', 'PNG').upper()
    if image_format not in ('PNG', 'JPG'):
        abort(400, 'Invalid format')
    delay_text = request.args.get('delay', '0')
    if not re.fullmatch(r'[0-9]{1,2}', delay_text) or int(delay_text) > 10:
        abort(400, 'Invalid delay')
    fullpage = request.args.get('fullpage', '0')
    if fullpage not in ('0', '1'):
        abort(400, 'Invalid fullpage')
    if not capture_slots.acquire(block=False):
        return jsonify(message='Capture capacity is full; retry shortly', error='Service Unavailable'), 503, {'Retry-After': '5'}
    try:
        from capture_runner import run_capture
        data = run_capture(url, width, height, image_format, int(delay_text), fullpage == '1', proxy)
    except RenderError as exc:
        abort(502, str(exc))
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        app.logger.exception('Capture failed')
        abort(502, 'Capture failed')
    finally:
        capture_slots.release()
    mime = 'image/jpeg' if image_format == 'JPG' else 'image/png'
    return Response(data, content_type=mime, headers={'Content-Disposition': f'attachment; filename="screenshot.{image_format.lower()}"', 'Cache-Control': 'no-store'})


if __name__ == '__main__':
    settings()
    app.run(port=5000)
