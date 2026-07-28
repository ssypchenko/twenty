import { canCreatePermaventCompanyOverviewWidgets } from '@/page-layout/utils/canCreatePermaventCompanyOverviewWidgets';
import { CoreObjectNameSingular } from 'twenty-shared/types';

describe('canCreatePermaventCompanyOverviewWidgets', () => {
  it('should allow Company widgets when the feature is enabled', () => {
    expect(
      canCreatePermaventCompanyOverviewWidgets({
        isFeatureEnabled: true,
        targetObjectNameSingular: CoreObjectNameSingular.Company,
      }),
    ).toBe(true);
  });

  it('should reject Company widgets when the feature is disabled', () => {
    expect(
      canCreatePermaventCompanyOverviewWidgets({
        isFeatureEnabled: false,
        targetObjectNameSingular: CoreObjectNameSingular.Company,
      }),
    ).toBe(false);
  });

  it('should reject widgets for other objects', () => {
    expect(
      canCreatePermaventCompanyOverviewWidgets({
        isFeatureEnabled: true,
        targetObjectNameSingular: CoreObjectNameSingular.Person,
      }),
    ).toBe(false);
  });
});
