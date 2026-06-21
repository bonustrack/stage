const madgeConfig = {
  fileExtensions: ['ts', 'tsx'],
  excludeRegExp: ['node_modules', '/dist/', '\\.d\\.ts$', '\\.vue$'],
  dependencyFilter: (id) => !id.endsWith('.vue'),
  detectiveOptions: {
    ts: { skipAsyncImports: true },
    tsx: { skipAsyncImports: true },
    es6: { skipAsyncImports: true },
  },
};

export { madgeConfig };
export default madgeConfig;
