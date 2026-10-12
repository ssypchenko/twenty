import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const permaventCompanyWideSidePanelWidthState = createAtomState<
  number | null
>({
  key: 'permaventCompanyWideSidePanelWidthV1',
  defaultValue: null,
  useLocalStorage: true,
  localStorageOptions: { getOnInit: true },
  validateInitFn: (payload) =>
    typeof payload === 'number' && Number.isFinite(payload) && payload >= 0,
});
