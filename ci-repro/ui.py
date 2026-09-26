import json, re, sys
xml = sys.stdin.read()
step = sys.argv[1]
nodes = []
for m in re.finditer(r'<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1)
    if t:
        nodes.append((t, int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))))
cards = {t: x1 for t, x1, y1, x2, y2 in nodes if re.fullmatch(r'(ALPHA|BETA|GAMMA|DELTA|NOLABEL) card 1', t)}
dismiss = [((x1 + x2) // 2, (y1 + y2) // 2) for t, x1, y1, x2, y2 in nodes if t.strip().lower() in ('continue', 'got it', 'ok', 'allow', 'close', 'dismiss', 'wait')]
out = {
    'step': step,
    'onBoard': any(t == 'Board' for t, *_ in nodes) and bool(cards),
    'cardX': cards,
    'tap': dismiss[0] if dismiss else None,
    'texts': [t for t, *_ in nodes][:25],
    'xmlBytes': len(xml),
}
print('UI ' + json.dumps(out))
