import { CoreObjectNameSingular } from 'twenty-shared/types';

export const isPermaventWideSidePanelObject = (
  objectNameSingular: string | undefined,
): boolean =>
  objectNameSingular === CoreObjectNameSingular.Company ||
  objectNameSingular === 'branch';
