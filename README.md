# Required environmental variables

| Variable             | Type of Value                                                          |
| -------------------- | ---------------------------------------------------------------------- |
| DISCORD_AUTH         | Discord Bot Authentication Token                                       |
| BOT_OWNER_DISCORD_ID | Discord User ID for Bot Owner                                          |
| BOT_NAME             | Name the bot will use as username, nickname, and prefix for data files |
|                      | (NB: Avoid using non-ascii characters to prevent unexpected behavior)  |
| NODE_ENV             | Node Environment: "production" or "development"                        |




# Bot settings

Default bot settings are stored in the `resources/default-settings.json` file. These should be copied to `resources/{bot name}-settings.json`.

The following are the required values for the bot settings:

| Value                 | Acceptable Range | Default Value | Description                                                                                           |
| --------------------- | ---------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| outburstThreshold     | 0.0 - 1.0        | 0.005         | Chance that the bot will respond without being explicitly triggered                                   |
| numberOfLines         | 1 - 100          | 1             | Number of lines the bot will generate each time                                                       |
| angerLevel            | 0.01 - 10.0      | 0.5           | Chance that the bot will yell. Values above 1.0 will cause the bot to always yell                     |
| angerIncrease         | 0.01 - 10.0      | 1.75          | Value that the angerLevel will be multiplied by if the bot witnesses yelling (all capitalized input)  |
| angerDecrease         | 0.01 - 10.0      | 0.8           | Value that the AngerLevel will be multipled by if the bot does not witness yelling                    |
| recursion             | 0 - 100          | 1             | Number of times the output of the bot is sent back in as input (for self-reinforcement learning)      |
| conversationTimeLimit | 0 - 100000       | 7000          | Number of milliseconds the bot will wait for a additional input without requiring its name to be said |
| learnFromBots         | true / false     | false         | Whether the bot will learn from other bots, or ignore them                                            |

# Steps to deploy initially (no pretrained brain) without git
1. Copy the following files and directories:
    - `./resources/*`
    - `./src/*`
    - `./tools/*` (NOTE: you should also run `chmod +x ./tools/*` for the scripts to properly execute)
    - `./Dockerfile`
    - `./docker-compose.yml`
    - `./package.json`
    - `./tsconfig.json`
    - `./README.md`
    - `./.gitattributes`
    - `./.dockerignore`
 2. Create the following files and directories:
    - `./.env` (See [Required environment variables](#required-environmental-variables))
    - `./data/`
    - (Optional) `./resources/{bot-name}-settings.json` (See [Bot settings](#bot-settings))
    - (Optional) `./resources/{bot-name}-trainer.{txt|json}` (See [Example trainer schema](https://github.com/mureni/charlies2/issues/1#issuecomment-774998882) 
        - You can also create a default trainer by running the following commands:
            - `cd ./tools/`
            - `./generate-trainer.sh`
        - This will create the file `./resources/default-trainer.txt` based off of data from the [ConvAI2 competition](https://convai.io)
        - WARNING: This requires the `curl` and `jq` programs to be installed
3. Install dependencies via `npm`:
    - `npm install`
4. Build a distribution version of the source:
    - `npm run build`
    - `docker-compose build`
5. Run `docker-compose` as a daemon:
    - `docker-compose up -d`

# Steps to install when using git
1. Create a directory for the project to exist in:
    - `mkdir -p ~/charlies`
    - `cd ~/charlies`
2. Clone the project:
    `git clone https://github.com/mureni/charlies2.git ~/charlies`
3. Create the following files and directories:
    - `./.env` (See [Required environment variables](#required-environmental-variables))
    - `./data/`
    - (Optional) `./resources/{bot-name}-settings.json` (See [Bot settings](#bot-settings))
    - (Optional) `./resources/{bot-name}-trainer.{txt|json}` (See [Example trainer schema](https://github.com/mureni/charlies2/issues/1#issuecomment-774998882) 
        - You can also create a default trainer by running the following commands:
            - `cd ./tools/`
            - `./generate-trainer.sh`
        - This will create the file `./resources/default-trainer.txt` based off of data from the [ConvAI2 competition](https://convai.io)
        - WARNING: This requires the `curl` and `jq` programs to be installed4. Install dependencies via `npm`:
    - `npm install`
5. Build a distribution version of the source:
    - `npm run build`
    - `docker-compose build`
6. Run `docker-compose` as a daemon:
    - `docker-compose up -d`

# Steps to update when using git
1. Run the `update` script:
    - `./tools/update.sh`

The update script, if not present, can be made as follows:
```bash
#!/bin/bash
echo "Stopping docker container for charlies..."
docker-compose down
echo "Retrieving most recent code from remote git origin (github), master branch..."
git pull origin master
echo "Rebuilding charlies docker image as needed..."
docker-compose build
echo "Starting docker container based off of charlies docker image..."
docker-compose up -d
```

This will pull the most recent code from the remote git repo

