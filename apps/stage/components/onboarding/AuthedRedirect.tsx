import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAccountGate } from '../../lib/accountGate';
import { safeNextRoute } from './nextRoute.model';

export function AuthedRedirect(): React.ReactElement | null {
  const gate = useAccountGate();
  const { next } = useLocalSearchParams<{ next?: string }>();
  return gate.ready && gate.hasAccount ? <Redirect href={safeNextRoute(next)} /> : null;
}
