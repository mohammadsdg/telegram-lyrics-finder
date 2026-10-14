import 'dotenv/config';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig() {
  return {
    botToken: required('BOT_TOKEN'),
    mysql: {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: positiveInteger('MYSQL_PORT', 3306),
      database: process.env.MYSQL_DATABASE || 'lyrics_bot',
      user: process.env.MYSQL_USER || 'lyrics_bot',
      password: required('MYSQL_PASSWORD'),
      connectionLimit: positiveInteger('MYSQL_CONNECTION_LIMIT', 10)
    },
    lrclib: {
      baseUrl: process.env.LRCLIB_BASE_URL || 'https://lrclib.net',
      userAgent: required('LRCLIB_USER_AGENT')
    },
    choiceTtlMinutes: positiveInteger('CHOICE_TTL_MINUTES', 30),
    logLevel: process.env.LOG_LEVEL || 'info'
  };
}
