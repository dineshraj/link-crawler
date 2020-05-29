const YELLOW = '\x1b[33m%s\x1b[0m';
const RED = '\x1b[31m%s\x1b[0m';

module.exports = {
  info: console.info,
  warn: (msg) => console.warn(YELLOW, msg),
  error: (msg) => console.error(RED, msg)
};
