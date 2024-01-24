FROM python:3.11-slim-bullseye

# Install dependencies for Chrome and fonts
RUN apt-get update && \
    apt-get install -y wget unzip apt-utils fonts-roboto fonts-noto fontconfig xfonts-utils jq curl && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install

# Install Microsoft Core Fonts
RUN echo "deb http://deb.debian.org/debian bullseye contrib" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ttf-mscorefonts-installer && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

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
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY . .

# Expose port 8080
EXPOSE 8080

CMD ["gunicorn", "--config", "./gunicorn_config.py", "app:app"]
