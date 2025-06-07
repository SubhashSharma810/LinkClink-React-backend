# Use Node.js base image
FROM node:20

# Install pipx + Python + yt-dlp + Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    python3 \
    python3-pip \
    pipx \
    python3-venv \
    curl \
    unzip \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally via pipx and ensure it's in PATH
RUN pipx ensurepath && \
    pipx install yt-dlp && \
    ln -s /root/.local/bin/yt-dlp /usr/local/bin/yt-dlp

# Install Chrome manually (stable)
RUN curl -sSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable

# Set Puppeteer executable path in environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Create app directory
WORKDIR /app

# Copy project files
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "index.js"]