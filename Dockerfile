FROM oven/bun:latest
WORKDIR /app
COPY package*.json /app/
RUN apt-get update && apt-get install -y python3 build-essential
RUN bun install
COPY . /app
EXPOSE 3000
CMD [ "bun", "run", "src/server.ts" ]