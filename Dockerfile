# Stage 1: Build
FROM python:3.11-slim-bullseye as builder

# Install dependencies required for building the application
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    apt-utils \
    curl \
    jq

# Fetch and install the latest stable ChromeDriver
RUN set -ex; \
    JSON_URL="https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json"; \
    LATEST_STABLE=$(curl -s $JSON_URL | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform == "linux64").url'); \
    if [ -n "$LATEST_STABLE" ] && [ "$LATEST_STABLE" != "null" ]; then \
        echo "Downloading ChromeDriver from: $LATEST_STABLE"; \
        wget "$LATEST_STABLE" -O chromedriver_linux64.zip && \
        unzip chromedriver_linux64.zip && \
        mv chromedriver-linux64/chromedriver /usr/bin/ && \
        chmod +x /usr/bin/chromedriver && \
        rm -rf chromedriver_linux64.zip chromedriver-linux64; \
    else \
        echo "Failed to resolve the latest stable ChromeDriver URL." >&2; \
        exit 1; \
    fi

# Clean up unnecessary packages and files to reduce image size
RUN apt-get remove --purge -y wget unzip apt-utils curl jq && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Stage 2: Runtime
FROM python:3.11-slim-bullseye

# Copy the ChromeDriver binary from the builder stage
COPY --from=builder /usr/bin/chromedriver /usr/bin/chromedriver

# Install Chrome
RUN apt-get update && apt-get install -y wget apt-transport-https apt-utils \
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install \
    && rm -rf /var/lib/apt/lists/* google-chrome-stable_current_amd64.deb

# Install runtime dependencies (fonts and minimal utilities)
RUN echo "deb http://deb.debian.org/debian bullseye contrib" >> /etc/apt/sources.list && \
    apt-get update && apt-get install -y --no-install-recommends \
    fonts-roboto \
    fonts-noto \
    fontconfig \
    xfonts-utils \
    ttf-mscorefonts-installer && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Noto Color Emoji font and configure fontconfig
RUN wget https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf -O /usr/share/fonts/NotoColorEmoji.ttf && \
    fc-cache -f -v && \
    echo '<?xml version="1.0"?>\n\
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n\
<fontconfig>\n\
    <alias>\n\
        <family>sans-serif</family>\n\
        <prefer>\n\
            <family>Noto Color Emoji</family>\n\
        </prefer>\n\
    </alias>\n\
    <alias>\n\
        <family>serif</family>\n\
        <prefer>\n\
            <family>Noto Color Emoji</family>\n\
        </prefer>\n\
    </alias>\n\
    <alias>\n\
        <family>monospace</family>\n\
        <prefer>\n\
            <family>Noto Color Emoji</family>\n\
        </prefer>\n\
    </alias>\n\
</fontconfig>' > /etc/fonts/local.conf

# Set the working directory
WORKDIR /app

# Install Python dependencies
#COPY --from=builder /root/.cache /root/.cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    rm -rf /root/.cache

# Copy the application
COPY . .

# Expose port 8080
EXPOSE 8080

CMD ["gunicorn", "--config", "./gunicorn_config.py", "app:app"]
