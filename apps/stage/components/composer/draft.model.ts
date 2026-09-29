interface DraftStep { text: string; attachments: { id: string }[]; location?: { id: string } }

export function unsentDraft<A extends { id: string }>(
  text: string, pending: A[], unsent: DraftStep[],
): { text: string; pending: A[] } {
  const ids = new Set(unsent.flatMap(s => [...s.attachments, ...(s.location ? [s.location] : [])].map(at => at.id)));
  return {
    text: unsent.some(s => s.text !== '' && !s.location) ? text : '',
    pending: pending.filter(at => ids.has(at.id)),
  };
}
