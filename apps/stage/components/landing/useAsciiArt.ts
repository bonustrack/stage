import { useEffect, useMemo, useState } from 'react';
import { ASCII, asciiFrame, asciiGrid } from './Landing.model';

export function useAsciiArt(width: number, height: number): string {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => { setTime((t) => t + ASCII.tickStep); }, ASCII.tickMs);
    return (): void => { clearInterval(id); };
  }, []);
  const { cols, rows } = asciiGrid(width, height);
  return useMemo(() => asciiFrame(cols, rows, time), [cols, rows, time]);
}
