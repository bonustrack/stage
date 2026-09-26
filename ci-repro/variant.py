import re, sys
name = sys.argv[1]
root = 'apps/stage/'

def edit(path, old, new):
    p = root + path
    s = open(p).read()
    if old not in s:
        sys.exit(f'anchor missing in {path}: {old[:60]}')
    open(p, 'w').write(s.replace(old, new, 1))

if name == 'v0-main':
    pass
elif name == 'v1-android-no-stack-swipe':
    edit('lib/navigation/rootStack.tsx', "import { withLayoutContext } from 'expo-router';",
         "import { Platform } from 'react-native';\nimport { withLayoutContext } from 'expo-router';")
    edit('lib/navigation/rootStack.tsx',
         'export const BOARD_SCREEN_OPTIONS: StackNavigationOptions = { gestureResponseDistance: PAGE_GUTTER };',
         "export const BOARD_SCREEN_OPTIONS: StackNavigationOptions = Platform.OS === 'android'\n  ? { gestureEnabled: false }\n  : { gestureResponseDistance: PAGE_GUTTER };")
elif name == 'v2-one-column-no-overflow':
    edit('components/board/BoardScreen.tsx', "const REPRO_LABELS = ['alpha', 'beta', 'gamma', 'delta'];", "const REPRO_LABELS = ['alpha'];")
    p = root + 'components/board/BoardScreen.tsx'
    s = open(p).read()
    s2 = re.sub(r"\)\)\), \{ convId: 'c-none-0'.*?\}\] as unknown", "))),] as unknown", s, count=1)
    if s2 == s:
        sys.exit('nolabel anchor missing')
    open(p, 'w').write(s2)
else:
    sys.exit('unknown variant ' + name)
print('applied', name)
