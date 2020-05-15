const Crawler = require('./crawler');

async function run(baseUrl) {
  const crawler = new Crawler(baseUrl);
  const siteUrls = await crawler.crawl(baseUrl);
  console.log(siteUrls);
}

module.exports = run;
