import { fireEvent, render } from '@testing-library/react';
import { type ReactNode } from 'react';

import { AdvancedFilterRelationTargetFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterRelationTargetFieldSelectMenu';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from 'twenty-shared/types';

const closeAdvancedFilterFieldSelectDropdown = jest.fn();
const applyAdvancedFilterSourceField = jest.fn();
const applyAdvancedFilterRelationTargetField = jest.fn();
const pushFocusForLeafFieldValuePicker = jest.fn();
const setObjectFilterDropdownIsSelectingRelationTargetField = jest.fn();

const accountOwnerField = {
  id: 'account-owner-field-id',
  label: 'Account Owner',
  icon: 'IconUserCircle',
  type: FieldMetadataType.RELATION,
  relation: {
    targetObjectMetadata: {
      id: 'workspace-member-object-id',
    },
  },
} as unknown as FieldMetadataItem;

jest.mock(
  '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown',
  () => ({
    useAdvancedFilterFieldSelectDropdown: () => ({
      closeAdvancedFilterFieldSelectDropdown,
      advancedFilterFieldSelectDropdownId: 'advanced-filter-dropdown-id',
    }),
  }),
);

jest.mock(
  '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterSourceField',
  () => ({
    useApplyAdvancedFilterSourceField: () => ({
      applyAdvancedFilterSourceField,
    }),
  }),
);

jest.mock(
  '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterRelationTargetField',
  () => ({
    useApplyAdvancedFilterRelationTargetField: () => ({
      applyAdvancedFilterRelationTargetField,
    }),
  }),
);

jest.mock(
  '@/object-record/advanced-filter/hooks/usePushFocusForLeafFieldValuePicker',
  () => ({
    usePushFocusForLeafFieldValuePicker: () => ({
      pushFocusForLeafFieldValuePicker,
    }),
  }),
);

jest.mock(
  '@/object-record/record-filter/hooks/useFilterableFieldMetadataItems',
  () => ({
    useFilterableFieldMetadataItems: () => ({
      filterableFieldMetadataItems: [],
    }),
  }),
);

jest.mock('@/object-metadata/utils/isManyToOneRelationField', () => ({
  isManyToOneRelationField: () => true,
}));

jest.mock(
  '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector',
  () => ({
    fieldMetadataItemUsedInDropdownComponentSelector: {},
  }),
);

jest.mock(
  '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState',
  () => ({
    objectFilterDropdownIsSelectingRelationTargetFieldComponentState: {},
  }),
);

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue',
  () => ({
    useAtomComponentSelectorValue: () => accountOwnerField,
  }),
);

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue',
  () => ({
    useAtomComponentStateValue: () => undefined,
  }),
);

jest.mock('@/ui/utilities/state/jotai/hooks/useSetAtomComponentState', () => ({
  useSetAtomComponentState: () =>
    setObjectFilterDropdownIsSelectingRelationTargetField,
}));

jest.mock('@/ui/layout/dropdown/components/DropdownContent', () => ({
  DropdownContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock(
  '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader',
  () => ({
    DropdownMenuHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);

jest.mock(
  '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent',
  () => ({
    DropdownMenuHeaderLeftComponent: () => null,
  }),
);

jest.mock('@/ui/layout/dropdown/components/DropdownMenuItemsContainer', () => ({
  DropdownMenuItemsContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/ui/layout/selectable-list/components/SelectableList', () => ({
  SelectableList: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/ui/layout/selectable-list/components/SelectableListItem', () => ({
  SelectableListItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('twenty-ui/navigation', () => ({
  MenuItem: ({
    onClick,
    testId,
    text,
  }: {
    onClick: () => void;
    testId?: string;
    text: string;
  }) => (
    <button data-testid={testId} onClick={onClick} type="button">
      {text}
    </button>
  ),
}));

jest.mock('twenty-ui/icon', () => ({
  IconChevronLeft: () => null,
  useIcons: () => ({ getIcon: () => () => null }),
}));

describe('AdvancedFilterRelationTargetFieldSelectMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow filtering directly on a many-to-one relation', () => {
    const { getByTestId } = render(
      <AdvancedFilterRelationTargetFieldSelectMenu recordFilterId="filter-id" />,
    );

    fireEvent.click(getByTestId('select-filter-relation-source'));

    expect(applyAdvancedFilterSourceField).toHaveBeenCalledWith({
      sourceFieldMetadataItem: accountOwnerField,
      recordFilterId: 'filter-id',
    });
    expect(pushFocusForLeafFieldValuePicker).toHaveBeenCalledWith(
      accountOwnerField,
    );
    expect(
      setObjectFilterDropdownIsSelectingRelationTargetField,
    ).toHaveBeenCalledWith(false);
    expect(closeAdvancedFilterFieldSelectDropdown).toHaveBeenCalled();
    expect(applyAdvancedFilterRelationTargetField).not.toHaveBeenCalled();
  });
});
