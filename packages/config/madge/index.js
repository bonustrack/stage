const madgeConfig = {
  fileExtensions: ['ts', 'tsx'],
  excludeRegExp: ['node_modules', '/dist/', '\\.d\\.ts$'],
  detectiveOptions: {
    ts: { skipAsyncImports: true },
    tsx: { skipAsyncImports: true },
    es6: { skipAsyncImports: true },
  },
};

export { madgeConfig };
export default madgeConfig;
