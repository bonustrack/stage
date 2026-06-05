// One-off local-build fix: expo-updates pulls org.bouncycastle:bcprov-jdk15to18:1.78.1
// while another native dep (transitive) pulls the legacy bcprov-jdk15on:1.68.
// Both ship the same classes → :app:checkDebugDuplicateClasses fails. Exclude
// the legacy artifact app-wide so only the 1.78.1 line survives.
const { withAppBuildGradle } = require('expo/config-plugins');

const SNIPPET = `
// withBouncyCastleDedup: drop legacy bcprov-jdk15on (dup classes vs jdk15to18 1.78.1)
configurations.all {
    exclude group: 'org.bouncycastle', module: 'bcprov-jdk15on'
    exclude group: 'org.bouncycastle', module: 'bcutil-jdk15on'
    exclude group: 'org.bouncycastle', module: 'bcpkix-jdk15on'
}
`;

module.exports = function withBouncyCastleDedup(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('withBouncyCastleDedup')) return cfg;
    cfg.modResults.contents += `\n${SNIPPET}\n`;
    return cfg;
  });
};
