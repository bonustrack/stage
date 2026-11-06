import { useComposerActions } from './actions';
import type { ComposerState } from './state';
import { ComposerCore, useComposerCore, type ComposerCoreProps } from './ComposerCore';

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

export function DraftComposer(props: Props): React.ReactElement {
  const s = props.state;
  const actions = useComposerActions({ ...s, openLine: NO_LINE });
  const coreProps: ComposerCoreProps = {
    s,
    actions,
    convId: null,
    draftKey: props.draftKey ?? null,
    draftOnly: true,
    mentionCandidates: props.mentionCandidates,
    suggestContacts: props.suggestContacts,
    autoFocusNonce: props.autoFocusNonce,
    busy: props.busy,
    placeholder: props.placeholder,
    rounded: props.rounded,
    quickAttach: props.quickAttach,
    header: props.header,
    onSend: props.onSubmit,
  };
  const core = useComposerCore(coreProps);
  return <ComposerCore {...coreProps} core={core} />;
}
