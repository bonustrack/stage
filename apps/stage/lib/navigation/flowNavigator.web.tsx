import {
  StackRouter, TabRouter, useNavigationBuilder,
  type DefaultNavigatorOptions, type Descriptor, type EventMapBase, type NavigationProp,
  type NavigationState, type ParamListBase, type StackActionHelpers, type StackNavigationState,
  type StackRouterOptions, type TabActionHelpers, type TabNavigationState, type TabRouterOptions,
} from '@react-navigation/native';
import { Box } from '@stage-labs/kit/react-native/box';

export type FlowScreenOptions = Record<string, unknown>;

type FlowNavigation<State extends NavigationState> =
  NavigationProp<ParamListBase, string, string | undefined, State, FlowScreenOptions, EventMapBase>;

type FlowProps<State extends NavigationState, RouterOptions> =
  DefaultNavigatorOptions<ParamListBase, string | undefined, State, FlowScreenOptions, EventMapBase, FlowNavigation<State>>
  & RouterOptions;

type FlowDescriptor<State extends NavigationState> =
  Descriptor<FlowScreenOptions, FlowNavigation<State>, State['routes'][number]>;

function focusedScreen<State extends NavigationState>(
  state: State, descriptors: Record<string, FlowDescriptor<State>>,
): React.ReactNode {
  const route = state.routes[state.index];
  if (route === undefined) return null;
  return descriptors[route.key]?.render() ?? null;
}

const HIDDEN = { display: 'none' } as const;

function stackScreens<State extends NavigationState>(
  state: State, descriptors: Record<string, FlowDescriptor<State>>,
): React.ReactNode {
  return state.routes.map((route, i) => (
    <Box key={route.key} style={i === state.index ? undefined : HIDDEN}>
      {descriptors[route.key]?.render() ?? null}
    </Box>
  ));
}

export function FlowStackNavigator({
  id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout,
}: FlowProps<StackNavigationState<ParamListBase>, StackRouterOptions>): React.ReactElement {
  const { state, descriptors, NavigationContent } = useNavigationBuilder<
    StackNavigationState<ParamListBase>, StackRouterOptions, StackActionHelpers<ParamListBase>,
    FlowScreenOptions, EventMapBase
  >(StackRouter, { id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout });
  return <NavigationContent>{stackScreens(state, descriptors)}</NavigationContent>;
}

export function FlowTabNavigator({
  id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout, backBehavior,
}: FlowProps<TabNavigationState<ParamListBase>, TabRouterOptions>): React.ReactElement {
  const { state, descriptors, NavigationContent } = useNavigationBuilder<
    TabNavigationState<ParamListBase>, TabRouterOptions, TabActionHelpers<ParamListBase>,
    FlowScreenOptions, EventMapBase
  >(TabRouter, { id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout, backBehavior });
  return <NavigationContent>{focusedScreen(state, descriptors)}</NavigationContent>;
}
