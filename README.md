[![Continuous Integration](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/python-app.yml/badge.svg)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/python-app.yml)
[![Docker Image](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/docker-image.yml/badge.svg)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# 📸 Selenium Screenshots API 🌐

This project provides a simple API service that uses Selenium and Google Chrome to take screenshots of websites. It's powered by Flask and can be containerized using Docker for ease of deployment.

## Table of Contents
- [✅ Requirements](#-requirements)
- [🛠️ Configuration](#%EF%B8%8F-configuration)
- [🧑‍💻 Usage](#-usage)
- [🐳 Running with Docker](#-running-with-docker)
- [🌐 Community](#-community)
  - [Contributing 👥](#contributing-)
  - [Reporting Bugs 🐛](#reporting-bugs-)
- [📄 License](#-license)

## ✅ Requirements

Python:
- Flask
- Flask_CORS
- Flask-RESTful
- Gunicorn
- Selenium
- URLlib3
- Werkzeug

Other:
- Google Chrome
- ChromeDriver (required for headless operation)

Install the required Python packages with pip:

```bash
pip install -r requirements.txt
```

>Note: You will also need ChromeDriver installed for headless operation on servers.

## 🛠️ Configuration
You can configure the API through environment variables such as setting the Flask secret key and the bearer token for authentication. The required environment variables are:

- `BEARER_TOKEN`: The token for bearer authentication.
- `ALLOWED_ORIGINS`: A comma-separated list of domains that are allowed to make cross-origin requests (CORS) to the API.

## 🧑‍💻 Usage
To start the Flask development server:

```bash
export ALLOWED_ORIGINS=*
python app.py
```

To run in production:
```bash
export BEARER_TOKEN=your_api_authentication_token
export ALLOWED_ORIGINS=https://example.com
python -m gunicorn --config ./gunicorn_config.py app:app
```

### API Endpoint
Make a GET request to `/screenshot` endpoint with the following parameters:

- `url` (required): The URL of the website to screenshot.
- `viewport` (optional, default '800x600'): The viewport size.
- `format` (optional, default 'png'): The screenshot format, supports png, jpg, jpeg.
- `delay` (optional, default '0'): The delay before the screenshot is taken to allow the page to load.
- `darkmode` (optional, default 'false'): A flag to toggle dark mode for the website. Accepts 'true' or 'false'.

### Examples
Request to capture a screenshot:

```http
GET https://example.com/screenshot?url=https://example.com&viewport=1024x768&format=jpg&delay=1
```

With cURL on command line:

```bash
curl -H "Authorization: Bearer YOUR_API_AUTHENTICATION_TOKEN" \ 
"https://example.com/screenshot?url=https%3A%2F%2Fexample.com&viewport=1024x768&format=jpg&delay=1" \
--output screenshot.jpg
```

## 🐳 Running with Docker
To build and run the application locally using Docker for testing:

```bash
docker buildx build --platform linux/amd64 -t selenium-screenshots .
docker run --platform linux/amd64 -p 5000:8080 \
-e BEARER_TOKEN="your_api_authentication_token" \
-e ALLOWED_ORIGINS="https://example.com" \
--name screenshot-service \
selenium-screenshots
```

Or pull the pre-built Docker image from GHCR.io on a server for production:
```bash
docker pull ghcr.io/rahb-realtors-association/selenium-screenshots:latest
docker run -d -p 8080:8080 \
-e BEARER_TOKEN="your_api_authentication_token" \
-e ALLOWED_ORIGINS="https://example.com" \
--name screenshot-service \
ghcr.io/rahb-realtors-association/selenium-screenshots:latest
```

## 🌐 Community

### Contributing 👥

Contributions, bug reports, and feature requests are welcome! Please refer to the contributing guidelines and the code of conduct.

[![Submit a PR](https://img.shields.io/badge/Submit_a_PR-GitHub-%23060606?style=for-the-badge&logo=github&logoColor=fff)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/compare)

### Reporting Bugs 🐛

Encountered a bug? Open an issue with details about the bug and how it can be reproduced.

[![Raise an Issue](https://img.shields.io/badge/Raise_an_Issue-GitHub-%23060606?style=for-the-badge&logo=github&logoColor=fff)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/issues/new/choose)

## 📄 License
This project is open source under the MIT license. See the [LICENSE](LICENSE) file for more info. 📜
