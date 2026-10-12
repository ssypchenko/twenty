import { CoreObjectNameSingular } from 'twenty-shared/types';

const PERMAVENT_OVERVIEW_WIDGET_OBJECTS = new Set([
  CoreObjectNameSingular.Company,
  'branch',
]);

export const canCreatePermaventCompanyOverviewWidgets = ({
  isFeatureEnabled,
  targetObjectNameSingular,
}: {
  isFeatureEnabled: boolean;
  targetObjectNameSingular: string;
}): boolean =>
  isFeatureEnabled &&
  PERMAVENT_OVERVIEW_WIDGET_OBJECTS.has(targetObjectNameSingular);
