import os
from flask import request, abort
from urllib.parse import urlparse

BEARER_TOKEN = os.environ.get('BEARER_TOKEN')

def authenticate():
    auth_header = request.headers.get('Authorization')
    if not BEARER_TOKEN:  # If no BEARER_TOKEN is set in the environment, allow access (optional)
        return
    if not auth_header or auth_header != f"Bearer {BEARER_TOKEN}":
        abort(401, "Unauthorized Access")

def validate_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False
