import { getPermaventCompanyWideSidePanelLayout } from '@/side-panel/permavent-company-wide-side-panel/utils/getPermaventCompanyWideSidePanelLayout';

describe('getPermaventCompanyWideSidePanelLayout', () => {
  it('returns null below the wide layout threshold', () => {
    expect(
      getPermaventCompanyWideSidePanelLayout({
        availableWidth: 1199,
        persistedWidth: null,
      }),
    ).toBeNull();
  });

  it.each([
    { availableWidth: 1200, expectedWidth: 840 },
    { availableWidth: 1600, expectedWidth: 1200 },
    { availableWidth: 1800, expectedWidth: 1360 },
  ])(
    'computes a $expectedWidth pixel default panel at $availableWidth pixels',
    ({ availableWidth, expectedWidth }) => {
      const layout = getPermaventCompanyWideSidePanelLayout({
        availableWidth,
        persistedWidth: null,
      });

      expect(layout?.width).toBe(expectedWidth);
      expect(layout?.constraints.default).toBe(expectedWidth);
    },
  );

  it('always reserves the minimum company list width', () => {
    const layout = getPermaventCompanyWideSidePanelLayout({
      availableWidth: 1800,
      persistedWidth: 2000,
    });

    expect(layout?.width).toBe(1480);
    expect(layout?.constraints.max).toBe(1480);
  });

  it('clamps a persisted width to the minimum panel width', () => {
    const layout = getPermaventCompanyWideSidePanelLayout({
      availableWidth: 1600,
      persistedWidth: 400,
    });

    expect(layout?.width).toBe(640);
  });

  it('uses a valid persisted width', () => {
    const layout = getPermaventCompanyWideSidePanelLayout({
      availableWidth: 1600,
      persistedWidth: 1000,
    });

    expect(layout?.width).toBe(1000);
  });
});
