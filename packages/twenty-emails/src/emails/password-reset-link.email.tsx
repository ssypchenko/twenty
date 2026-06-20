import { Trans } from '@lingui/react';
import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { Link } from 'src/components/Link';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type PasswordResetLinkEmailProps = {
  duration: string;
  hasPassword: boolean;
  link: string;
  locale: keyof typeof APP_LOCALES;
};

export const PasswordResetLinkEmail = ({
  duration,
  hasPassword,
  link,
  locale,
}: PasswordResetLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const headline = hasPassword
    ? i18n._('Reset your password')
    : i18n._('Set your password');
  const ctaLabel = hasPassword
    ? i18n._('Reset password')
    : i18n._('Set password');

  return (
    <BaseEmail locale={locale} logoBaseUrl={link}>
      <Title value={headline} />
      <MainText>
        {hasPassword ? (
          <Trans id="We received a request to reset the password for your account. Use the button below to choose a new password." />
        ) : (
          <Trans id="Your account is ready. Use the button below to create your password." />
        )}
      </MainText>
      <CallToAction href={link} value={ctaLabel} />
      <br />
      <MainText>
        {hasPassword ? (
          <Trans
            id="This link will expire in {duration}. If you did not request a password reset, you can safely ignore this email."
            values={{ duration }}
          />
        ) : (
          <Trans
            id="This link will expire in {duration}. If you were not expecting this email, you can safely ignore it."
            values={{ duration }}
          />
        )}
        <br />
        <br />
        <Trans id="If the button does not work, copy and paste the following link into your browser:" />
        <br />
        <Link href={link} value={link} />
      </MainText>
      <br />
    </BaseEmail>
  );
};

PasswordResetLinkEmail.PreviewProps = {
  duration: '24 hours',
  hasPassword: true,
  link: 'https://crm.example.com/reset-password/123',
  locale: 'en',
} as PasswordResetLinkEmailProps;

export default PasswordResetLinkEmail;
