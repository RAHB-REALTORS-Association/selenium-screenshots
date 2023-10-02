FROM python:3.11-slim-bullseye

# Install dependencies for Chrome
RUN apt-get update && \
    apt-get install -y wget unzip apt-utils jq && \
    CHROME_URL=$(curl -s https://availability.chromium.org/api/availability?format=json | jq -r '.items | .[] | select(.Channel == "stable") | .Url') && \
    wget $CHROME_URL && \
    dpkg -i google-chrome-stable_*.deb || apt-get -fy install

# Install Chromedriver
RUN CHROME_VERSION=$(google-chrome --version | awk '{ print $3 }' | awk -F'.' '{ print $1 }') && \
    CHROMEDRIVER_URL=$(curl -s "https://availability.chromium.org/api/availability?format=json" | jq -r --arg CHROME_VERSION "$CHROME_VERSION" '.items | .[] | select(.Channel == "stable" and .Major == $CHROME_VERSION) | .Url') && \
    wget $CHROMEDRIVER_URL/chromedriver_linux64.zip && \
    unzip chromedriver_linux64.zip && \
    mv chromedriver /usr/bin/chromedriver && \
    chmod +x /usr/bin/chromedriver

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
