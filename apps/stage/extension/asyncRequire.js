const asyncRequire = require('expo/src/async-require/asyncRequireModule');

asyncRequire.unstable_createWorker = function createWorker(url, options) {
  return new Worker(url, options);
};

module.exports = asyncRequire;
