import { canCreatePermaventCompanyOverviewWidgets } from '@/page-layout/utils/canCreatePermaventCompanyOverviewWidgets';
import { CoreObjectNameSingular } from 'twenty-shared/types';

describe('canCreatePermaventCompanyOverviewWidgets', () => {
  it.each([CoreObjectNameSingular.Company, 'branch'])(
    'should allow %s widgets when the feature is enabled',
    (objectName) => {
      expect(
        canCreatePermaventCompanyOverviewWidgets({
          isFeatureEnabled: true,
          targetObjectNameSingular: objectName,
        }),
      ).toBe(true);
    },
  );

  it.each([CoreObjectNameSingular.Company, 'branch'])(
    'should reject %s widgets when the feature is disabled',
    (objectName) => {
      expect(
        canCreatePermaventCompanyOverviewWidgets({
          isFeatureEnabled: false,
          targetObjectNameSingular: objectName,
        }),
      ).toBe(false);
    },
  );

  it('should reject widgets for other objects', () => {
    expect(
      canCreatePermaventCompanyOverviewWidgets({
        isFeatureEnabled: true,
        targetObjectNameSingular: CoreObjectNameSingular.Person,
      }),
    ).toBe(false);
  });
});
