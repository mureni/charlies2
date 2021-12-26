#!/bin/sh
echo "Stopping docker container for charlies..."
docker-compose down
echo "Retrieving most recent code from remote git origin (github), master branch..."
git pull origin master
echo "Rebuilding charlies docker image as needed..."
docker-compose build
echo "Starting docker container based off of charlies docker image..."
docker-compose up -d