import { router, useLocalSearchParams } from 'expo-router';
import { Onboarding } from './Onboarding';
import { safeNextRoute } from './nextRoute.model';

export function OnboardingPage(): React.ReactElement {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <Onboarding onDone={() => { router.replace(safeNextRoute(next)); }} />;
}
