#!/usr/bin/env node
const run = require('./runner');

const [, , ...args] = process.argv;
const baseURL = args[0];

function validateArg() {
  if (typeof baseURL !== 'string') {
    throw new Error(
      'No argument provided. Link Crawler needs to be provided with a URL'
    );
  }
  if (!/^https?:\/\//.test(baseURL)) {
    throw new Error('Provided URL must begin with HTTP or HTTPS');
  }
}

validateArg();
run(baseURL);
