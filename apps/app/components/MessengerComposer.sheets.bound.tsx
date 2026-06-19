/** @file ComposerSheets — poll/signature/payment bottom sheets bound to composer state + send actions. */
import { PollSheet, SignatureSheet, PaymentSheet } from './MessengerComposer.sheets';
import type { ComposerState } from './MessengerComposer.state';

/** Palette tuple shared by the composer sheets. */
interface SheetPalette { fg: string; sub: string; inputBg: string; chipBg: string }

/** Send-action callbacks the sheets fire on submit. */
interface SheetActions {
  sendPoll: () => void;
  sendSignatureRequest: () => void;
  sendTxRequest: () => void;
}

/** Renders the poll, signature, and payment bottom sheets wired to composer state. */
export function ComposerSheets({ s, palette, dark, actions }: {
  s: ComposerState; palette: SheetPalette; dark: boolean; actions: SheetActions;
}): React.ReactElement {
  return (
    <>
      <PollSheet
        open={s.pollOpen} onClose={() => { s.setPollOpen(false); }} palette={palette} dark={dark}
        question={s.pollQuestion} setQuestion={s.setPollQuestion}
        header={s.pollHeader} setHeader={s.setPollHeader}
        options={s.pollOptions} setOptions={s.setPollOptions}
        multi={s.pollMulti} setMulti={s.setPollMulti}
        onSend={actions.sendPoll}
      />
      <SignatureSheet
        open={s.sigOpen} onClose={() => { s.setSigOpen(false); }} palette={palette} dark={dark}
        kind={s.sigKind} setKind={s.setSigKind}
        desc={s.sigDesc} setDesc={s.setSigDesc}
        message={s.sigMessage} setMessage={s.setSigMessage}
        json={s.sigJson} setJson={s.setSigJson}
        onSend={actions.sendSignatureRequest}
      />
      <PaymentSheet
        open={s.txOpen} onClose={() => { s.setTxOpen(false); }} palette={palette} dark={dark}
        to={s.txTo} setTo={s.setTxTo}
        amount={s.txAmount} setAmount={s.setTxAmount}
        note={s.txNote} setNote={s.setTxNote}
        onSend={actions.sendTxRequest}
      />
    </>
  );
}
