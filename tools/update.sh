#!/bin/sh
set -eu

if [ -n "${1:-}" ] && [ -n "${2:-}" ]; then
  REMOTE="$1"
  BRANCH="$2"
elif [ -n "${1:-}" ]; then
  case "$1" in
    */*)
      REMOTE="${1%%/*}"
      BRANCH="${1#*/}"
      ;;
    *)
      REMOTE="origin"
      BRANCH="$1"
      ;;
  esac
else
  UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)
  if [ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "@{u}" ]; then
    REMOTE="${UPSTREAM%%/*}"
    BRANCH="${UPSTREAM#*/}"
  else
    REMOTE="origin"
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
  fi
fi

echo "Stopping docker container for charlies..."
docker-compose down
echo "Retrieving most recent code from remote '$REMOTE', branch '$BRANCH'..."
git pull "$REMOTE" "$BRANCH"
echo "Rebuilding charlies docker image as needed..."
docker-compose build
echo "Starting docker container based off of charlies docker image..."
docker-compose up -d
