FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build the Vite app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD [ "npm", "start" ]
