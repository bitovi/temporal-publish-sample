FROM node:16-slim as builder

RUN apt-get update && apt-get install
RUN npm install -g node-prune

WORKDIR /usr/src/app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.json tsconfig.json
