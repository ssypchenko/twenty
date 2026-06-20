import { type I18n } from '@lingui/core';
import { Container } from 'react-email';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <ShadowText>
        <>
          {i18n._('This is an automated email from Permavent.')}
          <br />
          {i18n._('Permavent Ltd')}
          <br />
          {i18n._(
            '11 Cumberland Drive · Granby Industrial Estate · Weymouth · DT4 9TB',
          )}
          <br />
          <Link href="https://permavent.co.uk" value="permavent.co.uk" />
        </>
      </ShadowText>
    </Container>
  );
};
