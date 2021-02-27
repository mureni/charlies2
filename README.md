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
    - `./Dockerfile`
    - `./package.json`
    - `./tsconfig.json`
    - `./README.md`
    - `./.gitattributes`
2. Create the following files and directories:
    - `./.env` (See [Required environment variables](#required-environmental-variables))
    - `./data/`
    - (Optional) `./resources/{bot-name}-settings.json` (See [Bot settings](#bot-settings))
    - (Optional) `./data/{bot-name}-trainer.json` (See [Example trainer schema](https://github.com/mureni/charlies2/issues/1#issuecomment-774998882) - NB: Format expected to be deprecated in favor of raw text and/or other pre-processors)