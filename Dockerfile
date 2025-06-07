# Use Node.js base image
FROM node:20

# Create app directory
WORKDIR /app

# Copy all backend files
COPY . .

# Install dependencies
RUN npm install

# Expose port Railway will use
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]