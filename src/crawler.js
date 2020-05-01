const cheerio = require('cheerio');
const axios = require('axios');
const EventEmitter = require('events');

const REQUEST = 'request';
const PROCESS_RESPONSE = 'response';
const PROCESSING_DONE = 'processing_done';

class Crawler extends EventEmitter {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
    this.siteUrls = {};
    this.urlsToProcess = 0;
    this.visitedURLs = new Set();

    this.on(REQUEST, this.request);
    this.on(PROCESS_RESPONSE, this.processResponse);
  }

  request(url, { depth }) {
    this.visitedURLs.add(url);
    this.urlsToProcess++;

    axios.get(url).then((res) => {
      this.urlsToProcess--;
      this.emit(PROCESS_RESPONSE, url, res, { depth });
    });
  }

  processResponse(currentUrl, res, { depth }) {
    this.siteUrls[this.baseUrl] = [];

    const aTags = cheerio.load(res.data)('a');
    aTags.each((_, { attribs: { href: childLink } }) => {
      this.siteUrls[this.baseUrl].push(childLink);
    });
    this.emit(PROCESSING_DONE);
  }

  crawl() {
    return new Promise((resolve) => {
      this.emit(REQUEST, this.baseUrl, { depth: 1 });
      this.on(PROCESSING_DONE, () => {
        if (this.urlsToProcess === 0) {
          resolve(this.siteUrls);
        }
      });
    });
  }
}

module.exports = Crawler;
