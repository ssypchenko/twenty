import { CommandMenuItem } from '@/command-menu/components/CommandMenuItem';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useLingui } from '@lingui/react/macro';
import { IconCheck, IconLogin2 } from 'twenty-ui/icon';

export const PERMAVENT_OPENING_TAB_SETTINGS_ITEM_ID =
  'permavent-record-opening-tab';

export type PermaventOpeningTabSettings = {
  isOpeningTab: boolean;
  onSetOpeningTab: () => void;
};

type PermaventOpeningTabSettingsItemProps = PermaventOpeningTabSettings;

export const PermaventOpeningTabSettingsItem = ({
  isOpeningTab,
  onSetOpeningTab,
}: PermaventOpeningTabSettingsItemProps) => {
  const { t } = useLingui();

  return (
    <SelectableListItem
      itemId={PERMAVENT_OPENING_TAB_SETTINGS_ITEM_ID}
      onEnter={isOpeningTab ? undefined : onSetOpeningTab}
    >
      <CommandMenuItem
        id={PERMAVENT_OPENING_TAB_SETTINGS_ITEM_ID}
        Icon={isOpeningTab ? IconCheck : IconLogin2}
        label={isOpeningTab ? t`Default opening tab` : t`Use as opening tab`}
        description={t`Side panel and mobile`}
        onClick={onSetOpeningTab}
        disabled={isOpeningTab}
      />
    </SelectableListItem>
  );
};
