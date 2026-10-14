# lyrics finder bot

Send it a song on Telegram and it sends the lyrics back.

The bot reads the title and artist from the audio file's metadata, then looks for a match on [LRCLIB](https://lrclib.net). If there are a few likely versions, it gives you buttons so you can pick the right one.

It doesn't download or listen to the audio. That keeps lookups quick and means you don't need a paid music recognition API.

## what it does

- reads the song title and artist from Telegram
- searches and ranks matching lyrics
- asks you to choose when the match isn't clear
- splits long lyrics into readable Telegram messages
- stores lookups and cached lyrics in MySQL
- makes sure only the original user can use the choice buttons

## stack

- Node.js 20+
- [Telegraf](https://telegraf.js.org/)
- MySQL 8+
- [LRCLIB](https://lrclib.net/)

## setup

Clone the repo and install the packages:

```bash
npm install
cp .env.example .env
```

Add your Telegram bot token and MySQL details to `.env`. You can get a bot token from [@BotFather](https://t.me/BotFather).

Create the database and tables:

```bash
mysql -u root -p < sql/init.sql
```

It's better to run the bot with its own MySQL user:

```sql
CREATE USER 'lyrics_bot'@'127.0.0.1' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON lyrics_bot.* TO 'lyrics_bot'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Use the same username and password in `.env`, then start the bot:

```bash
npm start
```

For development, `npm run dev` restarts the bot when a file changes.

## using the bot

Send the bot a song as a Telegram audio message. The audio needs both a title and performer tag—the same details Telegram shows above the player.

If the metadata is missing, update the file tags and send it again. The bot deliberately doesn't guess from the filename.

## tests

```bash
npm test
npm run check
```

## project notes

This version uses long polling, which is fine for running one instance. If you plan to scale it out, switching to webhooks and adding shared rate limiting would be a good next step.

LRCLIB asks API clients to identify themselves, so set `LRCLIB_USER_AGENT` to something that includes a real contact email.

The full request flow and file guide are in [roadmap.md](roadmap.md).
