import { readableSendError } from '@stage-labs/client/xmtp/clientErrors';

export interface SendTarget<C> {
  conv: C;
  assertCurrent: () => void;
}

export async function sendPreparedMessage<C>(steps: {
  find: () => Promise<SendTarget<C>>;
  beforeSend?: () => Promise<void>;
  send: (conv: C) => Promise<string>;
}): Promise<string> {
  const target = await steps.find();
  await steps.beforeSend?.();
  target.assertCurrent();
  return steps.send(target.conv);
}

export async function sendPreparedAttachment<R, C>(input: {
  assertCurrent: () => void;
  uploaded: () => Promise<R[]>;
  onUploaded?: (infos: R[]) => void;
  find: () => Promise<SendTarget<C>>;
  beforeSend?: () => Promise<void>;
  send: (conv: C, infos: R[]) => Promise<string>;
}): Promise<string> {
  input.assertCurrent();
  const infos = await input.uploaded();
  input.assertCurrent();
  input.onUploaded?.(infos);
  input.assertCurrent();
  return sendPreparedMessage({
    find: async () => {
      const target = await input.find();
      return {
        conv: target.conv,
        assertCurrent: () => {
          target.assertCurrent();
          input.assertCurrent();
        },
      };
    },
    beforeSend: input.beforeSend,
    send: (conv) => input.send(conv, infos),
  });
}

export async function withReadableSendError<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (err) {
    throw readableSendError(err);
  }
}
