const cheerio = require('cheerio');
const axios = require('axios');
const { ConcurrencyManager } = require('axios-concurrency');
const EventEmitter = require('events');
const { RateLimiter } = require('limiter');
const https = require('https');

const lang = require('./lang');
const logger = require('./logger');

const REQUEST = 'request';
const PROCESS_RESPONSE = 'response';
const PROCESSING_DONE = 'processing_done';

const RATE_LIMIT_MS = 5;
const MAX_CONCURRENT_REQUESTS = 20;
const PLACEHOLDER = '%s';

const httpsAgent = new https.Agent({ keepAlive: true });

class Crawler extends EventEmitter {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
    this.brokenUrls = [];
    this.urlsToProcess = 0;
    this.visitedURLs = new Set();
    this.requestId = 0;
    this.limiter = new RateLimiter(1, RATE_LIMIT_MS);
    this.axiosInstance = axios.create({
      timeout: 10000,
      httpsAgent
    });

    this.manager = ConcurrencyManager(
      this.axiosInstance,
      MAX_CONCURRENT_REQUESTS
    );

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

  logMessage(path, status, parentPath) {
    const message = this.formatString(lang.failed, path, status, parentPath);
    logger.error(message);
  }

  request(url, parentUrl, linkText, requestId) {
    this.urlsToProcess++;
    this.visitedURLs.add(url);

    this.limiter.removeTokens(1, () => {
      this.axiosInstance
        .get(url)
        .then((res) => {
          this.visitedURLs.add(url);
          this.urlsToProcess--;
          this.emit(PROCESS_RESPONSE, url, parentUrl, linkText, res);
        })
        .catch((err) => {
          this.urlsToProcess--;
          if (!err.response) {
            logger.warn(
              `${requestId}: Failed to fetch ${url}, ${err.message}, retrying...`
            );
            // retry URL if connection error
            this.emit(REQUEST, url, parentUrl, linkText, requestId);
          } else {
            this.emit(PROCESS_RESPONSE, url, parentUrl, linkText, err.response);
          }
        });
    });
  }

  processResponse(currentUrl, parentUrl, linkText, res) {
    const status = res.status;
    const { pathname: linkPath } = new URL(currentUrl);
    const currentLink = !this.formatUrl(currentUrl).includes(this.baseUrl)
      ? currentUrl
      : linkPath;
    const { pathname: parent } = parentUrl
      ? new URL(parentUrl)
      : { pathname: null };

    if (status >= 400) {
      this.logMessage(currentLink, status, parent);
    }

    try {
      if (status >= 400) {
        this.brokenUrls.push({
          brokenLink: currentLink,
          linkText,
          parent,
          status
        });
      } else {
        const $ = cheerio.load(res.data);
        const aTags = $('a');
        $(aTags).each((_, aTag) => {
          const linkText = $(aTag).text();
          const childHref = $(aTag).attr('href');
          const formattedChildUrl = this.formatUrl(childHref);
          const formattedParentUrl = this.formatUrl(parentUrl);

          // stops crawling of external domains after the initial link
          if (!formattedParentUrl.includes(this.baseUrl)) {
            return;
          }

          if (!this.visitedURLs.has(formattedChildUrl)) {
            this.emit(
              REQUEST,
              formattedChildUrl,
              currentUrl,
              linkText,
              this.requestId++
            );
          }
        });
      }
      this.emit(PROCESSING_DONE);
    } catch (e) {
      console.log(e.message);
    }
  }

  crawl() {
    return new Promise((resolve) => {
      this.emit(REQUEST, this.baseUrl, '', this.requestId++);
      this.on(PROCESSING_DONE, () => {
        if (this.urlsToProcess === 0) {
          this.manager.detach();
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
