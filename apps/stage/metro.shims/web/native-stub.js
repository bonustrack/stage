function makeStub(name) {
  function Stub() {
    this.stubName = String(name);
  }
  const handler = {
    get(target, prop) {
      if (prop === 'prototype') return target.prototype;
      if (prop === Symbol.toPrimitive || prop === 'toString') {
        return () => `[web-stub ${String(name)}]`;
      }
      if (!(prop in target)) {
        target[prop] = () =>
          Promise.reject(new Error(`native-only API ${String(name)}.${String(prop)} called on web`));
      }
      return target[prop];
    },
  };
  return new Proxy(Stub, handler);
}

module.exports = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default') return makeStub('default');
      if (!(prop in target)) target[prop] = makeStub(prop);
      return target[prop];
    },
  },
);
