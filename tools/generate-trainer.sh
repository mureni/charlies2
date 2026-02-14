#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(dirname "$SCRIPT_DIR")
OUTPUT_FILE="$ROOT_DIR/resources/default-trainer.txt"

# Create trainer file from ConvAI2 competition (see: https://convai.io)
curl -s https://convai.io/data/data_tolokers.json | jq -r '.[] | .dialog[] | select(.sender_class == "Human") | .text' | iconv -f UTF-8 -t ASCII//TRANSLIT | tr "[:upper:]" "[:lower:]" | sed -e 's/^[ \t]*//' | sort | uniq -u -i | awk 'NF>=3' > "$OUTPUT_FILE"

# What is actually happening here? See below: 

## Download conversational data from ConvAI2 competition (silently with -s)
# curl -s https://convai.io/data/data_tolokers.json 
## Retrieve only the text that other humans sent
# | jq -r '.[] | .dialog[] | select(.sender_class == "Human") | .text' 
## Convert any Unicode characters to ASCII representations
# | iconv -f UTF-8 -t ASCII//TRANSLIT 
## Convert uppercase characters to lowercase
# | tr "[:upper:]" "[:lower:]" 
## Trim leading and trailing white space
# | sed -e 's/^[ \t]*//'
## Sort the results alphabetically
# | sort 
## Return only unique results
# | uniq -u -i 
## Return only lines with 3 or more words
# | awk 'NF>=3' 
## Output to resources/default-trainer.txt file
# > "$OUTPUT_FILE"
