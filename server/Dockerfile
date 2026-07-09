FROM node:20-slim

# zeus and @babel/core must be global installs — a local install breaks
# zeus's module aliasing (see README.md).
RUN npm install -g @zeppos/zeus-cli @babel/core

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 8787
CMD ["npm", "start"]
