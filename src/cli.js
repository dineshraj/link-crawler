#!/usr/bin/env node
const lang = require('./lang');
const run = require('./runner');

const [, , ...args] = process.argv;
const baseURL = args[0];

function validateArg() {
  if (typeof baseURL !== 'string') {
    throw new Error(lang.noArgs);
  }
  if (!/^https?:\/\//.test(baseURL)) {
    throw new Error(lang.wrongProtocol);
  }
}

validateArg();
console.log(lang.scanning, '\n\n');
run(baseURL);
