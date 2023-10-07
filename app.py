import os
from flask import Flask, jsonify
from flask_restful import Api
from flask_cors import CORS
from resources.screenshot import ScreenshotAPI

app = Flask(__name__)

# Load the allowed origins from an environment variable and split by comma
# For example, your environment variable might look like:
# ALLOWED_ORIGINS=https://yourfrontenddomain1.com,https://yourfrontenddomain2.com
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'https://rahb-realtors-association.github.io').split(',')

# Apply CORS to your app with the list of allowed origins
CORS(app, origins=ALLOWED_ORIGINS)

api = Api(app)
api.add_resource(ScreenshotAPI, '/screenshot')

@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({"message": str(e.description)}), 400

@app.errorhandler(401)
def handle_unauthorized(e):
    return jsonify({"message": str(e.description)}), 401

@app.errorhandler(500)
def handle_internal_error(e):
    return jsonify({"message": "An unexpected error occurred while taking the screenshot"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
