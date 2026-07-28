import { CoreObjectNameSingular } from 'twenty-shared/types';

export const canCreatePermaventCompanyOverviewWidgets = ({
  isFeatureEnabled,
  targetObjectNameSingular,
}: {
  isFeatureEnabled: boolean;
  targetObjectNameSingular: string;
}): boolean =>
  isFeatureEnabled &&
  targetObjectNameSingular === CoreObjectNameSingular.Company;
