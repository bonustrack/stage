const { withGradleProperties } = require('expo/config-plugins');
const { setGradleMemory } = require('./nodejsMobileConfig');

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    setGradleMemory(cfg.modResults);
    return cfg;
  });
};
