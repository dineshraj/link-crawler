const cheerio = require('cheerio');
const axios = require('axios');
const EventEmitter = require('events');

TIME_BETWEEN_REQUESTS = 10;
VALID_PROTOCOLS = ['http', 'https'];

class Crawler extends EventEmitter {
  constructor(baseUrl) {
    super();
  }

  crawl() {
    return [];
  }
}

module.exports = Crawler;
