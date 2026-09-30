const withCallsAndroid = require('./calls-native/android');
const withCallsIos = require('./calls-native/ios');

function withCalls(config) {
  return withCallsIos(withCallsAndroid(config));
}

module.exports = withCalls;
