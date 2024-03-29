""" This module contains the ScreenshotAPI class which is a Flask-RESTful Resource """
import tempfile
import logging
import time
import os
from flask import request, send_file, abort
from flask_restful import Resource
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from werkzeug.utils import secure_filename
from utilities import authenticate, validate_url

logging.basicConfig(level=logging.INFO)

class ScreenshotAPI(Resource):
    def get(self):
        try:
            # Call the authenticate function
            response = authenticate()
            if response:
                return response

            # Input validation
            url = request.args.get('url')
            if not url or not validate_url(url):
                abort(400, "Invalid or missing URL")

            viewport = request.args.get('viewport', '1440x900')
            try:
                width, height = map(int, viewport.split('x'))
            except ValueError:
                abort(400, "Invalid viewport format. It should be <width>x<height>")
            MAX_SIZE = 9999  # Set to your desired max viewport size
            if not (0 < width <= MAX_SIZE) or not (0 < height <= MAX_SIZE):
                abort(400, f"Invalid viewport dimensions. Dimensions must be between 1 and {MAX_SIZE}")

            img_format = request.args.get('format', 'PNG').upper()
            if img_format not in ['PNG', 'JPG']:
                abort(400, "Invalid format. Supported formats are PNG, JPG")

            # Adding a delay with a cap
            delay = request.args.get('delay', default=0, type=int)
            MAX_DELAY = 30  # Set to your desired max delay
            if delay < 0 or delay > MAX_DELAY:
                abort(400, f"Invalid delay. Delay must be between 0 and {MAX_DELAY}")

            # Setup Selenium with headless Chrome
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--hide-scrollbars")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument(f"--window-size={width},{height}")

            driver = webdriver.Chrome(options=chrome_options)
            driver.set_page_load_timeout(30)  # set a 30-second timeout for page load

            # Create a secure temporary directory to store the screenshot
            tmp_dir = tempfile.mkdtemp()

            try:
                driver.get(url)
                time.sleep(delay)

                sanitized_name = secure_filename(f"screenshot.{format}")
                fullpath = os.path.normpath(os.path.join(tmp_dir, sanitized_name))

                if not fullpath.startswith(tmp_dir):
                    raise Exception("Operation not allowed")

                temp_file = tempfile.NamedTemporaryFile(dir=tmp_dir, delete=False, suffix=sanitized_name)
                temp_file_name = temp_file.name
                driver.save_screenshot(temp_file_name)
            except Exception as e:
                logging.error(f"An error occurred: {str(e)}")
                abort(500, "An error occurred while taking the screenshot")
            finally:
                driver.quit()

            # Serve the screenshot file
            response = send_file(temp_file_name, mimetype=f'image/{format}', as_attachment=True)
            response.headers["Content-Disposition"] = f"attachment; filename={sanitized_name}"
            return response

        finally:  # Cleanup after serving the screenshot
            if 'temp_file_name' in locals() and os.path.exists(temp_file_name):
                os.remove(temp_file_name)
                os.rmdir(tmp_dir)
