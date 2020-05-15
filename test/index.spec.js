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
  });

  it('returns a list of URLs indexed by page', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(200, homePage)
      .get('/news')
      .reply(200)
      .get('/about')
      .reply(200);
    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/news`]: [],
      [`${BASE_URL}/about`]: [],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('returns a list of URLs indexed by the page for multiple pages', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(200, homePage)
      .get('/news')
      .reply(200, newsPage)
      .get('/videos')
      .reply(200)
      .get('/contact')
      .reply(200)
      .get('/about')
      .reply(200, aboutPage);
    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/news`]: [`${BASE_URL}/videos`],
      [`${BASE_URL}/about`]: [`${BASE_URL}/contact`],
      [`${BASE_URL}/videos`]: [],
      [`${BASE_URL}/contact`]: [],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('handles relative paths', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(200, '<html><a href="/news"></a><a href="/about"></a></html>')
      .get('/news')
      .reply(200)
      .get('/about')
      .reply(200);
    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/news`]: [],
      [`${BASE_URL}/about`]: [],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('does not enter an infinite loop if the same link exists on more than one page', async () => {
    const nav = `<a href="${BASE_URL}/news"></a><a href="${BASE_URL}/about"></a>`;
    nock(BASE_URL)
      .persist()
      .get('/')
      .reply(200, `<html>${nav}<a href="/article">Article Link</a></html>`)
      .get('/news')
      .reply(200, `<html>${nav}News</html>`)
      .get('/about')
      .reply(200, `<html>${nav}About me</html>`)
      .get('/article')
      .reply(200, `<html>${nav}Article contents</html>`);

    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [
        `${BASE_URL}/news`,
        `${BASE_URL}/about`,
        `${BASE_URL}/article`,
      ],
      [`${BASE_URL}/news`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/about`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
      [`${BASE_URL}/article`]: [`${BASE_URL}/news`, `${BASE_URL}/about`],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('scopes the urls visited to pages under the given base URL', async () => {
    nock(`${BASE_URL}`)
      .persist()
      .get('/news')
      .reply(
        200,
        `<html><a href="/news/article1">Article Link</a><a href="/news/article2">Article Link</a></html>`
      )
      .get('/news/article1')
      .reply(
        200,
        `<html>Article 1<a href="http://www.i-am-not-real-123098.com">Sponsor</a></html>`
      )
      .get('/news/article2')
      .reply(
        200,
        `<html>Article 2<a href="/news/about">About</a><a href="http://www.i-am-not-real-123093.com">Sponsor 2</a></html>`
      )
      .get('/news/about')
      .reply(200);

    const crawler = new Crawler(`${BASE_URL}/news`);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}/news`]: [
        `${BASE_URL}/news/article1`,
        `${BASE_URL}/news/article2`,
      ],
      [`${BASE_URL}/news/about`]: [],
      [`${BASE_URL}/news/article1`]: [],
      [`${BASE_URL}/news/article2`]: [`${BASE_URL}/news/about`],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it('strips hashes from urls rather than treating them as separate links', async () => {
    nock(BASE_URL)
      .persist()
      .get('/')
      .reply(
        200,
        `<html><a href="/article1#intro">Article Link</a><a href="/article1#main">Article Link</a></html>`
      )
      .get('/article1')
      .reply(200);

    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [`${BASE_URL}/article1`],
      [`${BASE_URL}/article1`]: [],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });

  it.only('does not differentiate between urls with and without trailing slashes', async () => {
    nock(BASE_URL)
      .persist()
      .get('/')
      .reply(
        200,
        `<html><a href="/article1">Article Link</a><a href="/article1/">Article Link</a></html>`
      )
      .get('/article1')
      .reply(200);

    const crawler = new Crawler(BASE_URL);
    const urls = await crawler.crawl();
    const expectedUrls = {
      [`${BASE_URL}`]: [`${BASE_URL}/article1`],
      [`${BASE_URL}/article1`]: [],
    };

    assert.deepStrictEqual(urls, expectedUrls);
  });
});
