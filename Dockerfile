FROM node:16-slim as builder

RUN apt-get update && apt-get install
RUN npm install -g node-prune

WORKDIR /usr/src/app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.json tsconfig.json
COPY src src

RUN node-prune /usr/src/app
RUN npm ci
RUN npx tsc

FROM node:16-slim
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json package.json
COPY --from=builder /usr/src/app/package-lock.json package-lock.json
COPY --from=builder /usr/src/app/build/ build/
COPY --from=builder /usr/src/app/node_modules/ node_modules/

ENV APP_PORT=3000
EXPOSE 3000

CMD ["node", "build/app.js"]
