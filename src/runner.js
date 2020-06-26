const Crawler = require('./crawler');
const lang = require('./lang');

function formatDate(milliseconds) {
  const t = new Date(milliseconds);
  return `${t.getMinutes()}m ${t.getSeconds()}s`;
}

async function run(baseUrl) {
  const start = new Date();

  const crawler = new Crawler(baseUrl);
  const siteUrls = await crawler.crawl(baseUrl);
  const count = typeof siteUrls === 'string' ? 0 : siteUrls.length;

  const end = new Date() - start;

  const output = `
  
  ${lang.done}

  ${count} ${lang.found}

  ${lang.timeTaken.replace('%s', formatDate(end))}
  
  ${lang.baseUrl}: ${baseUrl}
  
  ${lang.results}
  `;
  console.log(output);
  console.table(siteUrls);
}

module.exports = run;
