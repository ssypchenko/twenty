import { FeatureFlagKey } from 'twenty-shared/types';

type FeatureFlagMetadata = {
  label: string;
  description: string;
  imagePath?: string;
};

export type PublicFeatureFlag = {
  key: FeatureFlagKey;
  metadata: FeatureFlagMetadata;
};

export const PUBLIC_FEATURE_FLAGS: PublicFeatureFlag[] = [
  {
    key: FeatureFlagKey.IS_CALENDAR_WEEK_VIEW_ENABLED,
    metadata: {
      label: 'Calendar Day and Week Views',
      description:
        'Display calendar records in daily or weekly layouts with optional end dates',
    },
  },
  {
    key: FeatureFlagKey.IS_JUNCTION_RELATIONS_ENABLED,
    metadata: {
      label: 'Junction Relations',
      description:
        'Enable many-to-many relations through junction tables configuration',
    },
  },
  {
    key: FeatureFlagKey.IS_SETTINGS_DISCOVERY_HERO_ENABLED,
    metadata: {
      label: 'Settings Discovery Hero',
      description:
        'Show the per-page hero illustration + video walkthrough modal on settings pages',
    },
  },
  {
    key: FeatureFlagKey.IS_PERMAVENT_COMPANY_WIDE_SIDE_PANEL_ENABLED,
    metadata: {
      label: 'Permavent Company Wide Side Panel',
      description:
        'Use the available desktop workspace for company records while keeping the company list visible',
    },
  },
  {
    key: FeatureFlagKey.IS_PERMAVENT_COMPANY_OVERVIEW_WIDGETS_ENABLED,
    metadata: {
      label: 'Permavent Company and Branch Overview Widgets',
      description:
        'Allow compact Notes and Tasks widgets to be added to Company and Branch record page layouts',
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
