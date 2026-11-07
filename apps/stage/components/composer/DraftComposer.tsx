import { useComposerActions } from './actions';
import type { ComposerState } from './state';
import { ComposerCore } from './ComposerCore';

interface Props {
  state: ComposerState;
  onSubmit: () => void;
  busy: boolean;
  draftKey?: string | null;
  mentionCandidates?: { address: string; name: string }[];
  suggestContacts?: boolean;
  autoFocusNonce?: number;
  placeholder?: string;
  rounded?: boolean;
  quickAttach?: boolean;
  header?: React.ReactNode;
}

const NO_LINE = (): Promise<string | null> => Promise.resolve(null);

export function DraftComposer({ state: s, onSubmit, draftKey, ...rest }: Props): React.ReactElement {
  const actions = useComposerActions({ ...s, openLine: NO_LINE });
  return <ComposerCore {...rest} s={s} actions={actions} convId={null} draftKey={draftKey ?? null} draftOnly onSend={onSubmit} />;
}
