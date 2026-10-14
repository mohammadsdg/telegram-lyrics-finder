const priorities = { error: 0, warn: 1, info: 2, debug: 3 };

export function createLogger(level = 'info') {
  const threshold = priorities[level] ?? priorities.info;

  function write(kind, message, details) {
    if (priorities[kind] > threshold) return;
    const entry = { time: new Date().toISOString(), level: kind, message };
    if (details !== undefined) entry.details = details;
    const line = JSON.stringify(entry);
    (kind === 'error' ? console.error : console.log)(line);
  }

  return {
    error: (message, details) => write('error', message, details),
    warn: (message, details) => write('warn', message, details),
    info: (message, details) => write('info', message, details),
    debug: (message, details) => write('debug', message, details)
  };
}
