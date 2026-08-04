import { CoreObjectNameSingular } from 'twenty-shared/types';

import { isPermaventWideSidePanelObject } from '@/side-panel/permavent-company-wide-side-panel/utils/isPermaventWideSidePanelObject';

describe('isPermaventWideSidePanelObject', () => {
  it.each([CoreObjectNameSingular.Company, 'branch'])(
    'enables wide mode for %s',
    (objectNameSingular) => {
      expect(isPermaventWideSidePanelObject(objectNameSingular)).toBe(true);
    },
  );

  it.each(['person', 'opportunity', undefined])(
    'keeps wide mode disabled for %s',
    (objectNameSingular) => {
      expect(isPermaventWideSidePanelObject(objectNameSingular)).toBe(false);
    },
  );
});
