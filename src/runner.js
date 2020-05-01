const Crawler = require('./crawler');

async function run(baseUrl) {
  const crawler = new Crawler(baseUrl);
  const siteLinks = await crawler.crawl(baseUrl);
  console.log(siteLinks);
}

module.exports = run;
