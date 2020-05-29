const cheerio = require('cheerio');
const axios = require('axios');
const EventEmitter = require('events');
const { RateLimiter } = require('limiter');
const lang = require('./lang');
const logger = require('./logger');

const RATE_LIMIT_MS = 10;

const REQUEST = 'request';
const PROCESS_RESPONSE = 'response';
const PROCESSING_DONE = 'processing_done';

const YELLOW = '\x1b[33m%s\x1b[0m';
const RED = '\x1b[31m%s\x1b[0m';

const PLACEHOLDER = '%s';

class Crawler extends EventEmitter {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
    this.brokenUrls = [];
    this.urlsToProcess = 0;
    this.visitedURLs = new Set();
    this.requestId = 0;
    this.limiter = new RateLimiter(1, RATE_LIMIT_MS);

    this.on(REQUEST, this.request);
    this.on(PROCESS_RESPONSE, this.processResponse);
  }

  formatString(string, ...parameters) {
    return [...parameters].reduce((accumulator, value) => {
      return accumulator.replace(PLACEHOLDER, value);
    }, string);
  }

  formatUrl(url) {
    const { origin, pathname } = new URL(url, this.baseUrl);
    const pathNameWithoutTrailingSlash = pathname.replace(/\/$/, '');

    return origin + pathNameWithoutTrailingSlash;
  }

  logMessage(url, status) {
    const message = this.formatString(lang.failed, url, status);

    if (status >= 300 && status < 400) {
      logger.warn(YELLOW, message);
    } else if (status >= 400) {
      logger.error(RED, message);
    } else if (status !== 200) {
      logger.info(message);
    }
  }

  request(url, parentUrl, requestId) {
    this.urlsToProcess++;
    this.visitedURLs.add(url);

    this.limiter.removeTokens(1, () => {
      axios
        .get(url)
        .then((res) => {
          this.urlsToProcess--;
          this.emit(PROCESS_RESPONSE, url, parentUrl, res);
        })
        .catch((err) => {
          // console.log(`${requestId}, Failed to GET ${url}, ${err.message}`);
          this.urlsToProcess--;
          this.emit(PROCESS_RESPONSE, url, parentUrl, err.response);
        });
    });
  }

  processResponse(currentUrl, parentUrl, res) {
    const status = res ? res.status : lang.noStatus;
    this.logMessage(currentUrl, status);

    if (res.status >= 400) {
      this.brokenUrls.push({
        brokenLink: currentUrl,
        parent: parentUrl,
        status: res.status
      });
    } else {
      const aTags = cheerio.load(res.data)('a');
      aTags.each((_, { attribs: { href: childLink } }) => {
        const formattedChildUrl = this.formatUrl(childLink);

        // stops crawling of external domains
        if (!formattedChildUrl.includes(this.baseUrl)) {
          return;
        }

        if (!this.visitedURLs.has(formattedChildUrl)) {
          this.emit(REQUEST, formattedChildUrl, currentUrl, this.requestId++);
        }
      });
    }

    this.emit(PROCESSING_DONE);
  }

  crawl() {
    return new Promise((resolve) => {
      this.emit(REQUEST, this.baseUrl, '', this.requestId++);
      this.on(PROCESSING_DONE, () => {
        if (this.urlsToProcess === 0) {
          if (this.brokenUrls.length === 0) {
            resolve(lang.success);
          }
          resolve(this.brokenUrls);
        }
      });
    });
  }
}

module.exports = Crawler;
