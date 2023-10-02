FROM python:3.11-slim-bullseye

# Install dependencies for Chrome
RUN apt-get update && \
    apt-get install -y wget unzip apt-utils && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install

# Install Chromedriver
# Download Chromedriver
RUN wget https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/117.0.5938.92/linux64/chromedriver-linux64.zip \
    unzip chromedriver_linux64.zip \
    mv chromedriver /usr/bin/chromedriver && chmod +x /usr/bin/chromedriver

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
