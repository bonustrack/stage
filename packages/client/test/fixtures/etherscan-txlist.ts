/** Recorded Etherscan v2 `txlist` response samples (trimmed to the rendered
 *  fields). Captured from real /v2/api?module=account&action=txlist bodies. */

/** A normal success response with one outbound contract call. */
export const okResponse = {
  status: '1',
  message: 'OK',
  result: [
    {
      hash: '0xabc',
      nonce: '42',
      timeStamp: '1700000000',
      from: '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df',
      to: '0x00000000006c3852cbef3e08e8df289169ede581',
      value: '0',
      isError: '0',
      functionName: 'fulfillBasicOrder(tuple parameters)',
      input: '0xfb0f3ee1',
      gasUsed: '120000',
      gasPrice: '20000000000',
    },
  ],
};

/** The "no history" response: status 0, result is the message string. */
export const emptyResponse = {
  status: '0',
  message: 'No transactions found',
  result: 'No transactions found',
};

/** A drifted/garbage envelope (e.g. an HTML error page parsed, or a proxy 200
 *  with a wrong body) - NOT the documented shape at all. */
export const garbageResponse = { error: 'gateway timeout', code: 504 };
