const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getTimestamp() {
  return new Date().toISOString();
}

function formatLog(level, message, meta = {}) {
  return JSON.stringify({ timestamp: getTimestamp(), level, message, ...meta }) + '\n';
}

function writeToFile(filename, content) {
  const filePath = path.join(LOG_DIR, filename);
  fs.appendFileSync(filePath, content);
}

const logger = {
  info(message, meta = {}) {
    const log = formatLog('INFO', message, meta);
    process.stdout.write(log);
    writeToFile('app.log', log);
  },
  warn(message, meta = {}) {
    const log = formatLog('WARN', message, meta);
    process.stdout.write(log);
    writeToFile('app.log', log);
  },
  error(message, meta = {}) {
    const log = formatLog('ERROR', message, meta);
    process.stderr.write(log);
    writeToFile('error.log', log);
    writeToFile('app.log', log);
  },
  audit(message, meta = {}) {
    const log = formatLog('AUDIT', message, meta);
    writeToFile('audit.log', log);
    writeToFile('app.log', log);
  },
  security(message, meta = {}) {
    const log = formatLog('SECURITY', message, meta);
    process.stderr.write(log);
    writeToFile('security.log', log);
    writeToFile('app.log', log);
  },
};

module.exports = { logger };
