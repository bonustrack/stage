import { Text } from '@stage-labs/kit/react-native/text';
import { AppModal } from '../AppModal';
import { Column } from '../layout';
import { cancelEmailSignIn, changeEmailSignInAddress, finishEmailSignIn, sendEmailSignInCode, useEmailSignIn } from '../../lib/emailSignIn';
import { CodeForm, EmailForm, GhostButton } from './EmailFields';
import { emailSignInCopy } from './EmailSignIn.model';

export function EmailSignIn(): React.ReactElement {
  const view = useEmailSignIn();
  const sentTo = view?.sentTo ?? null;
  const copy = emailSignInCopy(sentTo);
  return (
    <AppModal visible={view !== null} onClose={cancelEmailSignIn} title={copy.title}>
      {view === null ? null : (
        <Column gap={14} width="100%">
          <Text text={copy.about} size="2xs" color="secondary" textAlign="center" />
          {sentTo === null ? (
            <>
              <EmailForm action={copy.action} autoFocus onSend={sendEmailSignInCode} />
              <GhostButton label="Cancel" onPress={cancelEmailSignIn} />
            </>
          ) : (
            <CodeForm
              key={sentTo}
              action={copy.action}
              onVerify={finishEmailSignIn}
              onResend={() => sendEmailSignInCode(sentTo)}
              onChangeEmail={changeEmailSignInAddress}
            />
          )}
        </Column>
      )}
    </AppModal>
  );
}
