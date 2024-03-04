""" Main application file """
import os
from flask import Flask
from flask_restful import Api
from flask_cors import CORS
from resources.screenshot import ScreenshotAPI

app = Flask(__name__)

# ALLOWED_ORIGINS=https://yourfrontenddomain1.com,https://yourfrontenddomain2.com
origins = os.environ.get('ALLOWED_ORIGINS', 'https://screenshots.oncornerstone.app').split(',')

CORS(app, resources={r"*": {"origins": origins}}, supports_credentials=True)

api = Api(app)
api.add_resource(ScreenshotAPI, '/screenshot', endpoint='screenshot')
api.add_resource(ScreenshotAPI, '/api/capture', endpoint='capture')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
