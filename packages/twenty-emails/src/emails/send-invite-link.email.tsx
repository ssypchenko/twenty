import { Trans } from '@lingui/react';
import { Img } from 'react-email';
import { canvasTheme } from 'src/common-style';

import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { HighlightedContainer } from 'src/components/HighlightedContainer';
import { HighlightedText } from 'src/components/HighlightedText';
import { Link } from 'src/components/Link';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { getImageAbsoluteURI } from 'twenty-shared/utils';

type SendInviteLinkEmailProps = {
  link: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  serverUrl: string;
  locale: keyof typeof APP_LOCALES;
};

export const SendInviteLinkEmail = ({
  link,
  workspace,
  sender,
  serverUrl,
  locale,
}: SendInviteLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

  const senderName = [sender.firstName, sender.lastName]
    .filter(Boolean)
    .join(' ');
  const senderEmail = sender.email;
  const workspaceName = workspace.name ?? i18n._('your workspace');

  return (
    <BaseEmail width={333} locale={locale} logoBaseUrl={serverUrl}>
      <Title
        value={i18n._('Join {workspaceName}', {
          workspaceName,
        })}
      />
      <MainText>
        <Trans
          id="{senderName} (<0>{senderEmail}</0>) has invited you to join <1>{workspaceName}</1>."
          values={{ senderName, senderEmail, workspaceName }}
          components={{
            0: (
              <Link
                href={`mailto:${senderEmail}`}
                value={senderEmail}
                color={canvasTheme.font.colors.blue}
              />
            ),
            1: <b />,
          }}
        />
        <br />
        <br />
        <Trans id="Use the button below to accept the invitation and access the workspace. If you were not expecting this invitation, you can safely ignore this email." />
      </MainText>
      <HighlightedContainer>
        {workspaceLogo ? (
          <Img
            src={workspaceLogo}
            width={40}
            height={40}
            alt="Workspace logo"
          />
        ) : (
          <></>
        )}
        {workspace.name ? <HighlightedText value={workspace.name} /> : <></>}
        <CallToAction href={link} value={i18n._('Accept invitation')} />
      </HighlightedContainer>
    </BaseEmail>
  );
};

SendInviteLinkEmail.PreviewProps = {
  link: 'https://crm.example.com/invite/123',
  workspace: {
    name: 'Acme Inc.',
    logo: 'https://fakeimg.pl/200x200/?text=ACME&font=lobster',
  },
  sender: { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' },
  serverUrl: 'https://crm.example.com',
  locale: 'en',
} as SendInviteLinkEmailProps;

export default SendInviteLinkEmail;
