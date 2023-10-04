[![Continuous Integration](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/python-app.yml/badge.svg)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/python-app.yml)
[![Docker Image](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/docker-image.yml/badge.svg)](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# 📸 Selenium Screenshots API 🌐

This project provides a simple API service that uses Selenium and Chrome Headless to take screenshots of websites. It's powered by Flask and can be containerized using Docker for ease of deployment.

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

- Python
- Flask
- Flask_CORS
- Flask-RESTful
- Werkzeug
- Gunicorn
- Selenium
- ChromeDriver

Install the required Python packages with pip:

```bash
pip install -r requirements.txt
```

>Note: You also need Google Chrome and ChromeDriver installed for headless operation on servers.

## 🛠️ Configuration
You can configure the API through environment variables such as setting the Flask secret key and the bearer token for authentication. The required environment variables are:

- `BEARER_TOKEN`: The token for bearer authentication.

## 🧑‍💻 Usage
To start the Flask development server:

```bash
export BEARER_TOKEN=your_api_authentication_token
python app.py
```

To run in production:
```bash
export BEARER_TOKEN=your_api_authentication_token
python -m gunicorn --config ./gunicorn_config.py app:app
```

### API Endpoint
Make a GET request to `/screenshot` endpoint with the following parameters:

- `url` (required): The URL of the website to screenshot.
- `viewport` (optional, default '800x600'): The viewport size.
- `format` (optional, default 'png'): The screenshot format, supports png, jpg, jpeg.
- `delay` (optiona, default '0'): The delay before the screenshot is taken to allow the page to load.

### Examples
Request to capture a screenshot:

```http
GET https://example.com/screenshot?url=https://example.com&viewport=1024x768&format=jpg&delay=5
```

## 🐳 Running with Docker
To build and run the application using Docker:

```bash
docker build -t selenium-screenshots .
docker run -e BEARER_TOKEN=your_api_authentication_token -p 8080:8080 selenium-screenshots
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
