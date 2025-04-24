# Use a lightweight Node.js server image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install a simple HTTP server
RUN npm install -g http-server

# Copy application files
COPY index.html .
COPY script.js .
COPY styles.css .

# Expose the port the app runs on
EXPOSE 8080

# Command to run the app
CMD ["http-server", "-p", "8080", "--cors"]
