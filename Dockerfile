FROM python:3.9-slim

# Install dependencies for Chrome
RUN apt-get update && \
    apt-get install -y wget unzip apt-utils && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install

# Install Chromedriver
RUN CHROME_VERSION=$(google-chrome --version | awk '{ print $3 }' | awk -F'.' '{ print $1 }') && \
    wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE_$CHROME_VERSION && \
    CHROMEDRIVER_VERSION=$(cat LATEST_RELEASE_$CHROME_VERSION) && \
    wget https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux64.zip && \
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
