const assert = require('assert');
const nock = require('nock');

const Crawler = require('../src/crawler');

const BASE_URL = 'https://test.url';
const homePage = `<html>
    <a href="${BASE_URL}/news"></a>
    <a href="${BASE_URL}/about"></a>
  </html>`;
const newsPage = `<html>
    <a href="${BASE_URL}/videos"></a>
  </html>`;
const aboutPage = `<html>
<a href="${BASE_URL}/contact"></a>
</html>`;

describe('Link Crawler', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock(BASE_URL)
      .get('/')
      .reply(200, homePage)
      .get('/news')
      .reply(200, newsPage)
      .get('/about')
      .reply(200, aboutPage);
  });

  it('returns a list of URLs from a given URL if only one page', async () => {
    nock(BASE_URL).get('/').reply(200, homePage);
    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = [`${BASE_URL}/news`, `${BASE_URL}/about`];

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('returns a list of URLs sorted by the page there are on', async () => {
    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}/`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/news`]: [`${BASE_URL}/videos`],
      [`${BASE_URL}/about`]: [`${BASE_URL}/contact`],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });
});
