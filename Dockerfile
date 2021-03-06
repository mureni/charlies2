FROM node:14.15.4-alpine AS base

## Install build toolchain, install node deps and compile native add-ons
RUN apk add --no-cache python make g++ sudo curl jq build-base libpng libpng-dev jpeg-dev pango-dev cairo-dev giflib-dev
RUN apk --no-cache add ca-certificates wget && \
    wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
    wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.32-r0/glibc-2.32-r0.apk && \
    apk add glibc-2.32-r0.apk
        
COPY package.json /tmp/package.json
RUN cd /tmp && npm install 
RUN mkdir -p /opt/charlies/node_modules/ && chown -R node:node /opt/charlies/
RUN cp -a /tmp/node_modules /opt/charlies/

FROM base as code
USER node
WORKDIR /opt/charlies/

## Replaced in docker-compose.yml

# RUN npm install --build-from-source
# RUN mkdir -p ./data && chown -R node:node ./data
# COPY --chown=node:node ./data/ ./data/
# VOLUME /data

COPY --chown=node:node . /opt/charlies

## Replaced in docker-compose.yml

RUN ./node_modules/.bin/tsc 
# CMD [ "node", "./dist/index.js" ]   
