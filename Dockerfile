FROM python:3.11-slim-bookworm

# Debian ships Chromium and its matching driver together, on amd64 and arm64.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver chromium-sandbox fonts-roboto fonts-noto fonts-noto-color-emoji \
    fontconfig ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py gunicorn_config.py ./
RUN useradd --create-home --uid 10001 screenshot
USER screenshot
ENV CHROME_BIN=/usr/bin/chromium CHROMEDRIVER_BIN=/usr/bin/chromedriver
EXPOSE 8080
CMD ["gunicorn", "--config", "./gunicorn_config.py", "app:app"]
