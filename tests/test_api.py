import os
import unittest
from unittest.mock import patch
from app import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.env = patch.dict(os.environ, {'BEARER_TOKEN': 'test-token', 'SCREENSHOT_PROXY': 'http://proxy:3128'})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_auth_and_configuration(self):
        response = self.client.get('/screenshot?url=https://example.com')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.content_type, 'application/json')
        self.assertIn('message', response.get_json())
        with patch.dict(os.environ, {'SCREENSHOT_PROXY': ''}):
            self.assertEqual(self.client.get('/screenshot?url=https://example.com').status_code, 503)

    def test_validation(self):
        headers = {'Authorization': 'Bearer test-token'}
        for url in ('http://127.0.0.1', 'http://169.254.169.254', 'file:///tmp/a', 'http://user@host'):
            self.assertEqual(self.client.get('/screenshot', query_string={'url': url}, headers=headers).status_code, 400)
        for params in ({'viewport': '9999x9999'}, {'delay': '-1'}, {'format': 'gif'}, {'fullpage': 'yes'}):
            self.assertEqual(self.client.get('/screenshot', query_string={'url': 'https://example.com', **params}, headers=headers).status_code, 400)

    def test_aliases_and_formats(self):
        headers = {'Authorization': 'Bearer test-token'}
        with patch('app.capture', return_value=b'image') as capture:
            for route in ('/screenshot', '/api/capture'):
                for fmt, mime in (('PNG', 'image/png'), ('JPG', 'image/jpeg')):
                    response = self.client.get(route, query_string={'url': 'https://example.com', 'format': fmt}, headers=headers)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.content_type, mime)
                    self.assertEqual(response.data, b'image')
            self.assertEqual(capture.call_count, 4)

if __name__ == '__main__':
    unittest.main()

class CaptureTests(unittest.TestCase):
    def test_cleanup_after_navigation_failure(self):
        from app import capture
        with patch('app.wait_for_render'), patch('app.Service'), patch('app.webdriver.Chrome') as chrome:
            driver = chrome.return_value
            driver.get.side_effect = RuntimeError('navigation failed')
            with self.assertRaises(RuntimeError):
                capture('https://example.com', 800, 600, 'PNG', 0, False, 'http://proxy:3128')
            driver.quit.assert_called_once()

    def test_jpeg_encoding_and_metrics(self):
        from app import capture
        import base64
        with patch('app.wait_for_render'), patch('app.Service'), patch('app.webdriver.Chrome') as chrome:
            driver = chrome.return_value
            driver.execute_cdp_cmd.return_value = {'data': base64.b64encode(b'\xff\xd8\xff').decode()}
            self.assertEqual(capture('https://example.com', 800, 600, 'JPG', 0, False, 'http://proxy:3128'), b'\xff\xd8\xff')
            self.assertEqual(driver.execute_cdp_cmd.call_args_list[0].args[1]['width'], 800)
            captures = [c for c in driver.execute_cdp_cmd.call_args_list if c.args[0] == 'Page.captureScreenshot']
            self.assertEqual(captures[0].args[1]['format'], 'jpeg')
            driver.quit.assert_called_once()

    def test_fullpage_limit_cleans_up(self):
        from app import capture
        from werkzeug.exceptions import BadRequest
        with patch('app.wait_for_render'), patch('app.Service'), patch('app.webdriver.Chrome') as chrome:
            driver = chrome.return_value
            driver.execute_script.return_value = [2000, 20000]
            with self.assertRaises(BadRequest):
                capture('https://example.com', 800, 600, 'PNG', 0, True, 'http://proxy:3128')
            driver.quit.assert_called_once()
