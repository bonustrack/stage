import { Col, PANE_LEFT_PAD, viewportFill } from '../layout';
import { usePalette } from '../../lib/theme';

export function SplitPlaceholder(): React.ReactElement {
  const { border } = usePalette();
  return <Col background={border} style={[viewportFill(), PANE_LEFT_PAD]}/>;
}
