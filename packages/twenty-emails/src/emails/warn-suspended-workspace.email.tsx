import { Trans } from '@lingui/react';
import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type WarnSuspendedWorkspaceEmailProps = {
  daysSinceInactive: number;
  inactiveDaysBeforeDelete: number;
  userName: string;
  workspaceDisplayName: string | undefined;
  serverUrl: string;
  locale: keyof typeof APP_LOCALES;
};

export const WarnSuspendedWorkspaceEmail = ({
  daysSinceInactive,
  inactiveDaysBeforeDelete,
  userName,
  workspaceDisplayName,
  serverUrl,
  locale,
}: WarnSuspendedWorkspaceEmailProps) => {
  const i18n = createI18nInstance(locale);
  const daysLeft = inactiveDaysBeforeDelete - daysSinceInactive;
  const dayOrDays = daysLeft > 1 ? 'days' : 'day';
  const remainingDays = daysLeft > 0 ? daysLeft : 0;

  return (
    <BaseEmail width={333} locale={locale} logoBaseUrl={serverUrl}>
      <Title value={i18n._('Suspended Workspace')} />
      <MainText>
        {userName?.length > 1 ? (
          <Trans id="Dear {userName}," values={{ userName }} />
        ) : (
          <Trans id="Hello," />
        )}
        <br />
        <br />
        <Trans
          id="It appears that your workspace <0>{workspaceDisplayName}</0> has been suspended for {daysSinceInactive} days."
          values={{ workspaceDisplayName, daysSinceInactive }}
          components={{ 0: <b /> }}
        />
        <br />
        <br />
        <Trans
          id="The workspace will be deactivated in {remainingDays} {dayOrDays}, and all its data will be deleted."
          values={{ remainingDays, dayOrDays }}
        />
        <br />
        <br />
        <Trans
          id="If you wish to continue using your workspace, please update your subscription within the next {remainingDays} {dayOrDays}."
          values={{ remainingDays, dayOrDays }}
        />
      </MainText>
      <br />
      <CallToAction
        href={new URL('/settings/billing', serverUrl).toString()}
        value={i18n._('Update your subscription')}
      />
      <br />
      <br />
    </BaseEmail>
  );
};

WarnSuspendedWorkspaceEmail.PreviewProps = {
  daysSinceInactive: 10,
  inactiveDaysBeforeDelete: 14,
  userName: 'John Doe',
  workspaceDisplayName: 'Acme Inc.',
  serverUrl: 'https://crm.example.com',
  locale: 'en',
};

export default WarnSuspendedWorkspaceEmail;
