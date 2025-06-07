# 1. Use Node.js base image
FROM node:20

# 2. Set working directory
WORKDIR /app

# 3. Copy backend files
COPY . .

# 4. Install dependencies
RUN npm install

# 5. Install yt-dlp (via Python)
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg wget gnupg ca-certificates && \
    pip3 install yt-dlp

# 6. Install full Chrome for Puppeteer
RUN apt-get install -y curl unzip && \
    curl -O https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt install -y ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb

# 7. Let Puppeteer find Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# 8. Expose backend port
EXPOSE 5000

# 9. Start your server
CMD ["node", "index.js"]