import { isCompactActivityWidgetLayout } from '@/page-layout/widgets/utils/isCompactActivityWidgetLayout';
import { PageLayoutTabLayoutMode } from '~/generated-metadata/graphql';

describe('isCompactActivityWidgetLayout', () => {
  it('should use compact activity widgets in vertical-list tabs', () => {
    expect(
      isCompactActivityWidgetLayout(PageLayoutTabLayoutMode.VERTICAL_LIST),
    ).toBe(true);
  });

  it('should preserve standard activity widgets in Canvas tabs', () => {
    expect(isCompactActivityWidgetLayout(PageLayoutTabLayoutMode.CANVAS)).toBe(
      false,
    );
  });
});
