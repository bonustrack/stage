import { Flex, type FlexProps } from './row';

export type { Align, FlexProps, Justify, Surface } from './row';

export function Column(props: FlexProps): React.ReactElement {
  return <Flex direction="col" {...props} />;
}
