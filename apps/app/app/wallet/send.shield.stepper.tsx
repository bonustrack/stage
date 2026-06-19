/** 4-stage shield-status stepper shown during/after a shield:
 *    1. Submitting tx   2. Confirming on-chain
 *    3. Scanning into private balance   4. Shielded ✓
 *
 *  Stages 1-2 are driven by the form's tx submit + receipt wait; stage 3
 *  ('Scanning') is the indeterminate Railgun merkle-scan tail (resolves when the
 *  shielded balance lands — see lib/railgun/shieldScan.ts); stage 4 is the
 *  terminal success. A failure paints the active stage red. Purely
 *  presentational: the caller maps its phase to a `ShieldStage`. */
import { Text } from '@metro-labs/kit/text';

import { Col, Row, Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { DANGER } from '../../lib/theme';

interface Pal { sub: string; head: string; link: string }

/** Where the shield is right now. `error` marks the in-progress stage failed. */
export type ShieldStage = 'idle' | 'submitting' | 'confirming' | 'scanning' | 'done' | 'error';

const ERR = DANGER;

const STEPS: readonly (readonly [ShieldStage, string])[] = [
  ['submitting', 'Submitting transaction'],
  ['confirming', 'Confirming on-chain'],
  ['scanning', 'Scanning into private balance'],
  ['done', 'Shielded'],
];
const ORDER: ShieldStage[] = ['submitting', 'confirming', 'scanning', 'done'];

function stageIndex(s: ShieldStage): number {
  return s === 'idle' || s === 'error' ? -1 : ORDER.indexOf(s);
}

/** A single step row: a status dot (done ✓ / active spinner / pending hollow)
 *  + its label, plus an optional sub-hint under the active step. */
function Step({ label, state, hint, pal }: {
  label: string; state: 'done' | 'active' | 'pending' | 'error'; hint?: string; pal: Pal;
}): React.ReactElement {
  const color = state === 'done' ? pal.link : state === 'error' ? ERR
    : state === 'active' ? pal.head : pal.sub;
  return (
    <Col gap={2}>
      <Row align="center" gap={10}>
        <Box width={18} height={18} align="center" justify="center">
          {state === 'active' ? <Spinner size={14} color={pal.link}/>
            : state === 'done' ? <Text weight="semibold" size="md">✓</Text>
            : state === 'error' ? <Text weight="semibold" size="md" color={ERR}>✕</Text>
            : <Box width={8} height={8} radius="xs" background={pal.sub} style={{ opacity: 0.5 }} />}
        </Box>
        <Text weight="semibold" size="md" color={color}>{label}</Text>
      </Row>
      {hint ? (
        <Text size="xs" color={pal.sub} style={{ paddingLeft: 28 }}>{hint}</Text>
      ) : null}
    </Col>
  );
}

/** The full 4-step stepper. Renders nothing while idle.
 *  @param errorAt  index (0-3) of the step that failed, when `stage==='error'`. */
export function ShieldStepper({ stage, pal, errorAt = 0 }: {
  stage: ShieldStage; pal: Pal; errorAt?: number;
}): React.ReactElement | null {
  if (stage === 'idle') return null;
  const cur = stageIndex(stage);
  return (
    <Col padding={{ x: 4, top: 4 }} gap={12}>
      {STEPS.map(([id, label]) => {
        const idx = ORDER.indexOf(id);
        let state: 'done' | 'active' | 'pending' | 'error';
        if (stage === 'error') state = idx < errorAt ? 'done' : idx === errorAt ? 'error' : 'pending';
        else if (stage === 'done') state = 'done';
        else if (idx < cur) state = 'done';
        else if (idx === cur) state = 'active';
        else state = 'pending';
        const hint = state === 'active' && id === 'scanning'
          ? 'This can take a few minutes…' : undefined;
        return <Step key={id} label={label} state={state} hint={hint} pal={pal} />;
      })}
    </Col>
  );
}
