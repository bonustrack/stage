export async function sendPreparedMessage<C>(
  find: () => Promise<C>,
  send: (conv: C) => Promise<string>,
  beforeSend?: () => Promise<void>,
): Promise<string> {
  const conv = await find();
  await beforeSend?.();
  return send(conv);
}
