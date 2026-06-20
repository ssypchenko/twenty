import { Img } from 'react-email';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  baseUrl: string;
};

export const Logo = ({ baseUrl }: LogoProps) => {
  const logoUrl = new URL(
    '/images/branding/permavent-logo.png',
    baseUrl,
  ).toString();

  return (
    <Img
      src={logoUrl}
      alt="Permavent logo"
      width="200"
      height="39"
      style={logoStyle}
    />
  );
};
