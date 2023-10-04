FROM python:3.11-slim-bullseye

# Install dependencies for Chrome and fonts
RUN apt-get update && \
    apt-get install -y wget unzip apt-utils fonts-noto fontconfig xfonts-utils && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install

# Install Microsoft Core Fonts
RUN echo "deb http://deb.debian.org/debian bullseye contrib" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ttf-mscorefonts-installer && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Chromedriver
RUN wget https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/117.0.5938.92/linux64/chromedriver-linux64.zip && \
    unzip chromedriver-linux64.zip && \
    mv chromedriver-linux64/chromedriver /usr/bin/ && \
    chmod +x /usr/bin/chromedriver && \
    rm -rf chromedriver-linux64 chromedriver-linux64.zip

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
