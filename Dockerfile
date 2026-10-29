FROM python:3.15.2-slim-bookworm@sha256:4e03260adeeebafccd084f3584e6b84823aba5651cfb53ef8a078ed441ddf9cd AS driver
ARG CHROMEDRIVER_VERSION=156.0.8078.74
ARG CHROMEDRIVER_SHA256=308f87940ec84d9adfd6079a71ddfc864fbeab102125d6726f6ae5da4fbfaf45
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && curl -fsSL --max-time 120 "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" -o /tmp/driver.zip \
    && echo "${CHROMEDRIVER_SHA256}  /tmp/driver.zip" | sha256sum -c - \
    && unzip -q /tmp/driver.zip -d /driver

FROM python:3.15.2-slim-bookworm@sha256:4e03260adeeebafccd084f3584e6b84823aba5651cfb53ef8a078ed441ddf9cd
ARG TARGETARCH
ARG BRAVE_VERSION=1.98.62
# This Chromium-based runtime includes an opt-in software HEVC decoder on Linux.
# Keep its Chromium version aligned with the pinned ChromeDriver above.
RUN test "$TARGETARCH" = amd64 \
    && apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates fonts-roboto fonts-noto fonts-noto-color-emoji fontconfig \
    && curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg --max-time 30 \
        https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg \
    && curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources --max-time 30 \
        https://brave-browser-apt-release.s3.brave.com/brave-browser.sources \
    && apt-get update && apt-get install -y --no-install-recommends "brave-browser=${BRAVE_VERSION}" \
    && rm -rf /var/lib/apt/lists/*
COPY --from=driver /driver/chromedriver-linux64/chromedriver /usr/bin/chromedriver
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py rendering.py capture_runner.py capture_worker.py gunicorn_config.py socket_proxy.py container_entrypoint.py ./
RUN useradd --create-home --uid 10001 screenshot \
    && mkdir -p /run/capture \
    && chown screenshot:screenshot /run/capture \
    && chmod 2770 /run/capture
USER screenshot
ENV CHROME_BIN=/usr/bin/brave-browser CHROMEDRIVER_BIN=/usr/bin/chromedriver BROWSER_SOFTWARE_HEVC=1
EXPOSE 8080
ENTRYPOINT ["python", "/app/container_entrypoint.py"]
CMD ["gunicorn", "--config", "./gunicorn_config.py", "app:app"]
