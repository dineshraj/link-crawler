const cheerio = require('cheerio');
const axios = require('axios');
const EventEmitter = require('events');

class Crawler extends EventEmitter {
  constructor(baseUrl) {
    super();
    this.links = [];
    this.baseUrl = baseUrl;
  }

  async crawl() {
    await axios.get(this.baseUrl).then((res) => {
      const aTags = cheerio.load(res.data)('a');
      aTags.each((_, aTag) => {
        this.links.push(aTag.attribs.href);
      });
    });
    return this.links;
  }
}

module.exports = Crawler;
