/** Shared topnav for the System menu + its sub-pages — back arrow + title,
 *  mirroring the Accounts page. */

import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';

export function SystemHeader({ title, dark, fg, head, border, right }: {
  title: string; dark: boolean; fg: string; head: string; border: string;
  right?: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: border,
    }}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={fg} />
      </Pressable>
      <Title dark={dark} style={{ color: head, fontSize: 20 }}>{title}</Title>
      {right ? <Box style={{ flex: 1, alignItems: 'flex-end' }}>{right}</Box> : null}
    </Box>
  );
}
