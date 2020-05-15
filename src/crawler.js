const cheerio = require('cheerio');
const axios = require('axios');
const EventEmitter = require('events');
const { RateLimiter } = require('limiter');

const RATE_LIMIT_MS = 10;

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
    this.requestId = 0;
    this.limiter = new RateLimiter(1, RATE_LIMIT_MS);

    this.on(REQUEST, this.request);
    this.on(PROCESS_RESPONSE, this.processResponse);
  }

  request(url, requestId) {
    this.urlsToProcess++;
    this.visitedURLs.add(url);

    this.limiter.removeTokens(1, () => {
      axios
        .get(url)
        .then((res) => {
          this.urlsToProcess--;
          this.emit(PROCESS_RESPONSE, url, res);
        })
        .catch((err) => {
          console.log(`${requestId}, Failed to GET ${url}, ${err.message}`);
          this.urlsToProcess--;
          this.emit(PROCESSING_DONE);
        });
    });
  }

  formatUrl(url) {
    const { origin, pathname } = new URL(url, this.baseUrl);
    const pathNameWithoutTrailingSlash = pathname.replace(/\/$/, '');

    return origin + pathNameWithoutTrailingSlash;
  }

  processResponse(currentUrl, res) {
    this.siteUrls[currentUrl] = [];

    const aTags = cheerio.load(res.data)('a');
    aTags.each((_, { attribs: { href: childLink } }) => {
      const formattedChildUrl = this.formatUrl(childLink);

      if (!formattedChildUrl.includes(this.baseUrl)) {
        return;
      }

      if (!this.siteUrls[currentUrl].includes(formattedChildUrl)) {
        this.siteUrls[currentUrl].push(formattedChildUrl);
      }

      if (!this.visitedURLs.has(formattedChildUrl)) {
        this.emit(REQUEST, formattedChildUrl, this.requestId++);
      }
    });
    this.emit(PROCESSING_DONE);
  }

  crawl() {
    return new Promise((resolve) => {
      this.emit(REQUEST, this.baseUrl, this.requestId++);
      this.on(PROCESSING_DONE, () => {
        if (this.urlsToProcess === 0) {
          resolve(this.siteUrls);
        }
      });
    });
  }
}

module.exports = Crawler;
