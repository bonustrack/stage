export function makeSeenCheck(isSeen: () => boolean, onSeen: () => void): () => void {
  let seen = false;
  return () => {
    const now = isSeen();
    if (now && !seen) onSeen();
    seen = now;
  };
}
