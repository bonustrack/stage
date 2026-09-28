module.exports = {
  fileHookTransform(source, chunk) {
    if (source.type !== 'contents' || source.id !== 'expoConfig' || chunk === null) return chunk;
    const config = JSON.parse(chunk.toString());
    delete config.extra?.gitHash;
    delete config.extra?.commitTime;
    delete config.extra?.buildProfile;
    return JSON.stringify(config);
  },
};
