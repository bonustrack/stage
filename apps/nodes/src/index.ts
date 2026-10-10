import { handlePriceNode } from './priceNode.ts';

export default {
  fetch: (request: Request): Promise<Response> => handlePriceNode(request, caches.default),
};
