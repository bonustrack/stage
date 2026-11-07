export interface AttachmentSource {
  uri: string | null;
  mime: string | undefined;
  failed: boolean;
}

type LocalCopy = { uri: string; mime?: string } | undefined;

function inlineSource(att: { mime?: string }, inlineUri: string, local: LocalCopy): AttachmentSource {
  return { uri: local?.uri ?? inlineUri, mime: local?.mime ?? att.mime, failed: false };
}

export function attachmentSource(
  att: { mime?: string; remote?: unknown },
  inlineUri: string,
  local: LocalCopy,
  remote: { uri: string | null; mime?: string; isError: boolean },
): AttachmentSource {
  if (att.remote === undefined) return inlineSource(att, inlineUri, local);
  return { uri: local?.uri ?? remote.uri, mime: remote.mime ?? local?.mime ?? att.mime, failed: remote.isError && !local };
}
