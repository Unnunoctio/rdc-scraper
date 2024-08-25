# Use the official Bun image
FROM oven/bun:1.1.14

# Install curl and any other necessary dependencies
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and bun.lockb (if you have one)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=PRODUCTION

# Run the application
CMD ["bun", "src/index.ts"]