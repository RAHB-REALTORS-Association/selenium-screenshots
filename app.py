from flask import Flask
from flask_restful import Api
from resources.screenshot import ScreenshotAPI

app = Flask(__name__)
api = Api(app)
api.add_resource(ScreenshotAPI, '/screenshot')

if __name__ == '__main__':
    app.run(debug=True, port=5000)