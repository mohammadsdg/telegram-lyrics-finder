import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createDatabase } from './db.js';
import { createLrclibClient } from './services/lrclib.js';
import { createBot } from './bot.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const database = createDatabase(config.mysql);
const lyricsClient = createLrclibClient(config.lrclib);
const bot = createBot({
  token: config.botToken,
  database,
  lyricsClient,
  choiceTtlMinutes: config.choiceTtlMinutes,
  logger
});

await database.ping();
logger.info('Connected to MySQL');

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  logger.info('Stopping bot', { signal });
  bot.stop(signal);
  await database.close();
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
logger.info('Telegram lyrics bot is running');
