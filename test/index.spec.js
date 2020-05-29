const assert = require('assert');
const sinon = require('sinon');
const nock = require('nock');

const Crawler = require('../src/crawler');
const lang = require('../src/lang');
const logger = require('../src/logger');

const BASE_URL = 'https://test.url';
const sandbox = sinon.createSandbox();

describe('Link Crawler', () => {
  beforeEach(() => {
    nock.cleanAll();
    sandbox.restore();
    sandbox.stub(console, 'error').returns();
  });

  it('returns a success message when no links are broken', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/news"></a>
          <a href="${BASE_URL}/about"></a>
        </html>`
      )
      .get('/news')
      .reply(200)
      .get('/about')
      .reply(200);
    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = lang.success;

    assert.strictEqual(output, expectedOutput);
  });

  it('returns an array when the there is only one link and it is broken', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
        <a href="${BASE_URL}/news">News</a>
      </html>`
      )
      .get('/news')
      .reply(502);

    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = [
      {
        brokenLink: '/news',
        linkText: 'News',
        parent: '/',
        status: 502
      }
    ];
    assert.deepStrictEqual(output, expectedOutput);
  });

  it('returns an array with broken links when some are broken', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/news">News</a>
          <a href="${BASE_URL}/about"></a>
        </html>`
      )
      .get('/news')
      .reply(502)
      .get('/about')
      .reply(200);
    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = [
      {
        brokenLink: '/news',
        linkText: 'News',
        parent: '/',
        status: 502
      }
    ];
    assert.deepStrictEqual(output, expectedOutput);
  });

  it('logs an error to the console when encountering a 4xx or 5xx error code', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/news"></a>
          <a href="${BASE_URL}/about"></a>
        </html>`
      )
      .get('/news')
      .reply(404)
      .get('/about')
      .reply(200);

    sandbox.stub(logger, 'error');
    const crawler = new Crawler(BASE_URL);
    await crawler.crawl();

    sandbox.assert.calledOnce(logger.error);
    sandbox.assert.calledWithMatch(
      logger.error,
      'Fetched /news, status: 404, parent: /'
    );
  });

  it('can navigate multiple pages', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/news"></a>
          <a href="${BASE_URL}/about"></a>
        </html>`
      )
      .get('/news')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/videos"></a>
        </html>`
      )
      .get('/videos')
      .reply(200)
      .get('/contact')
      .reply(200)
      .get('/about')
      .reply(
        200,
        `<html>
          <a href="${BASE_URL}/contact"></a>
        </html>`
      );
    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = lang.success;

    assert.deepStrictEqual(output, expectedOutput);
  });

  it('handles relative paths', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(200, '<html><a href="/news"></a><a href="/about"></a></html>')
      .get('/news')
      .reply(200)
      .get('/about')
      .reply(200);

    sandbox.stub(logger, 'warn');
    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = lang.success;

    assert.deepStrictEqual(output, expectedOutput);
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
    const output = await crawler.crawl();
    const expectedOutput = lang.success;

    assert.strictEqual(output, expectedOutput);
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
    nock('http://www.i-am-not-real-123098.com').get('/').reply(502);

    const crawler = new Crawler(`${BASE_URL}/news`);
    const output = await crawler.crawl();
    const expectedOutput = lang.success;

    assert.strictEqual(output, expectedOutput);
  });

  it('strips hashes from urls rather than treating them as separate links', async () => {
    nock(BASE_URL)
      .get('/')
      .reply(
        200,
        `<html>
          <a href="/article1#intro">One</a>
          <a href="/article1#main"></a>
          <a href="/about"></a>
        </html>`
      )
      .get('/article1')
      .reply(404)
      .get('/about')
      .reply(200);

    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = [
      {
        brokenLink: '/article1',
        linkText: 'One',
        parent: '/',
        status: 404
      }
    ];
    assert.deepStrictEqual(output, expectedOutput);
  });

  it('does not differentiate between urls with and without trailing slashes', async () => {
    nock(BASE_URL)
      .persist()
      .get('/')
      .reply(
        200,
        `<html><a href="/article1">Article Link</a><a href="/article1/">Article Link</a></html>`
      )
      .get('/article1/')
      .reply(502)
      .get('/article1')
      .reply(502);

    const crawler = new Crawler(BASE_URL);
    const output = await crawler.crawl();
    const expectedOutput = [
      {
        brokenLink: '/article1',
        linkText: 'Article Link',
        parent: '/',
        status: 502
      }
    ];

    assert.deepStrictEqual(output, expectedOutput);
  });
});
