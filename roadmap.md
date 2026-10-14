# roadmap

This is a quick map of how the bot works, what's in the repo, and what would be worth building next.

## how a lookup works

1. A user sends an audio file to the bot.
2. Telegraf reads the `title` and `performer` fields provided by Telegram.
3. The lookup is saved in MySQL and sent to LRCLIB.
4. Search results are cleaned up, scored, and deduplicated.
5. A clear match is returned straight away.
6. If a few versions are close, the bot shows up to five buttons.
7. The chosen lyrics are loaded from MySQL and sent in chunks if they're too long for one message.

The bot never downloads the audio. It only works with the metadata Telegram gives it.

## what's being used

| Tech | Job |
|---|---|
| Node.js | Runs the bot and calls the lyrics API |
| Telegraf | Handles Telegram messages, commands, and buttons |
| MySQL | Stores users, searches, choices, and lyrics |
| mysql2 | Talks to MySQL with prepared statements and transactions |
| LRCLIB | Provides the lyrics search API |
| dotenv | Loads local settings from `.env` |
| Node test runner | Runs the unit tests without another test framework |

## files

| File | What it's for |
|---|---|
| `src/index.js` | Starts everything and shuts it down cleanly |
| `src/bot.js` | Telegram commands, audio messages, and button clicks |
| `src/config.js` | Reads and validates environment variables |
| `src/db.js` | Contains the MySQL queries and transactions |
| `src/logger.js` | Writes simple JSON logs |
| `src/services/lrclib.js` | Searches LRCLIB and cleans up its response |
| `src/services/matching.js` | Scores search results and decides when to show choices |
| `src/utils/messages.js` | Reads audio metadata and formats Telegram messages |
| `sql/init.sql` | Creates the database and tables |
| `test/` | Unit tests for matching and message handling |
| `.env.example` | List of settings the app expects |

## matching

Title similarity makes up 65% of a result's score and artist similarity makes up the other 35%. The comparison ignores casing, accents, punctuation, featured-artist suffixes, and common labels such as live or remastered versions.

Results scoring below `0.45` are dropped. The best result is picked automatically when it scores at least `0.92` and leads the next result by `0.12` or more. Otherwise the user gets a list of choices. These values can be tuned in `src/services/matching.js`.

## database

- `users` keeps basic Telegram user details.
- `lyrics_cache` stores lyrics returned by LRCLIB.
- `lookup_requests` tracks each search and its current state.
- `lookup_candidates` connects a search to its possible matches.

Candidate results are saved in a transaction so a lookup never ends up half-written. Choice buttons also belong to the user who started the search and expire after the configured time.

## next up

- let users correct the artist and title when the file tags are wrong
- add rate limiting before opening the bot to a larger audience
- add integration tests around MySQL and the external API
- clean up expired lookup rows on a schedule
- add webhooks, health checks, and metrics for a production deployment
- support a second lyrics provider as an optional fallback
