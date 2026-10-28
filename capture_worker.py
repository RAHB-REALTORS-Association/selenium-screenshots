"""One isolated capture process; stdin is a JSON argument list, stdout is image bytes."""
import json
import sys

from werkzeug.exceptions import HTTPException
from app import capture
from rendering import RenderError

if __name__ == '__main__':
    try:
        sys.stdout.buffer.write(capture(*json.load(sys.stdin)))
    except Exception as error:
        code = error.code if isinstance(error, HTTPException) else 502
        message = error.description if isinstance(error, HTTPException) else str(error) if isinstance(error, RenderError) else 'Capture failed'
        sys.stderr.write(json.dumps({'code': code, 'message': message}))
        sys.exit(1)
