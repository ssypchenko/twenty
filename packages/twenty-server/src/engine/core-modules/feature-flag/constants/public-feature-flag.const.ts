import { FeatureFlagKey } from 'twenty-shared/types';

type FeatureFlagMetadata = {
  label: string;
  description: string;
  icon: string;
  imagePath?: string;
};

export type PublicFeatureFlag = {
  key: FeatureFlagKey;
  metadata: FeatureFlagMetadata;
};

export const PUBLIC_FEATURE_FLAGS: PublicFeatureFlag[] = [
  {
    key: FeatureFlagKey.IS_PERMAVENT_COMPANY_WIDE_SIDE_PANEL_ENABLED,
    metadata: {
      label: 'Permavent Company and Branch Wide Side Panel',
      description:
        'Use the available desktop workspace for company and branch records while keeping the list visible',
      icon: 'IconLayoutSidebarLeftExpand',
    },
  },
  {
    key: FeatureFlagKey.IS_PERMAVENT_COMPANY_OVERVIEW_WIDGETS_ENABLED,
    metadata: {
      label: 'Permavent Company and Branch Overview Widgets',
      description:
        'Allow compact Notes and Tasks widgets to be added to Company and Branch record page layouts',
      icon: 'IconNotes',
    },
  },
  ...(process.env.CLOUDFLARE_API_KEY
    ? [
        // {
        // Here you can add cloud only feature flags
        // },
      ]
    : []),
];
