
import { Topnav } from '../Topnav';
import { useTopnavSlot } from './topnavSlots';

export function HoistedTopnav(): React.ReactElement {
  const slot = useTopnavSlot();
  if (slot?.override) return <>{slot.override}</>;
  return <Topnav right={slot?.right} />;
}
