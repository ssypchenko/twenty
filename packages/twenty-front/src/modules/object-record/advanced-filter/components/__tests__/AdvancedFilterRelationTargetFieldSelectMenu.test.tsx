import { fireEvent, render, waitFor } from '@testing-library/react';
import { type ReactNode, useEffect, useState } from 'react';

import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { AdvancedFilterRelationTargetFieldSelectMenu } from '@/object-record/advanced-filter/components/AdvancedFilterRelationTargetFieldSelectMenu';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

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

jest.mock('twenty-ui/icon', () => ({
  IconChevronLeft: () => null,
  useIcons: () => ({ getIcon: () => () => null }),
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

const INSTANCE_ID = 'advanced-filter-relation-target-test';
const FILTER_ID = 'relation-target-filter';

const opportunity = getMockObjectMetadataItemOrThrow('opportunity');

const workspaceMemberRelationField = opportunity.fields.find(
  (field) =>
    isManyToOneRelationField(field) &&
    field.relation.targetObjectMetadata.nameSingular === 'workspaceMember',
);

const nonWorkspaceMemberRelationField = opportunity.fields.find(
  (field) =>
    isManyToOneRelationField(field) &&
    field.relation.targetObjectMetadata.nameSingular !== 'workspaceMember',
);

if (!workspaceMemberRelationField || !nonWorkspaceMemberRelationField) {
  throw new Error('Missing expected relation fields in opportunity mock');
}

const BaseWrapper = getJestMetadataAndApolloMocksWrapper({ apolloMocks: [] });

const CurrentRecordFiltersObserver = () => {
  const currentRecordFilters = useAtomComponentStateValue(
    currentRecordFiltersComponentState,
  );

  return (
    <div data-testid="current-record-filters">
      {JSON.stringify(currentRecordFilters)}
    </div>
  );
};

const Seed = ({
  sourceFieldMetadataId,
  children,
}: {
  sourceFieldMetadataId: string;
  children: ReactNode;
}) => {
  const setFieldMetadataItemIdUsedInDropdown = useSetAtomComponentState(
    fieldMetadataItemIdUsedInDropdownComponentState,
  );

  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    setFieldMetadataItemIdUsedInDropdown(sourceFieldMetadataId);
    setIsSeeded(true);
  }, [sourceFieldMetadataId, setFieldMetadataItemIdUsedInDropdown]);

  return isSeeded ? <>{children}</> : null;
};

const renderSubMenu = (sourceFieldMetadataId: string) => {
  return render(
    <BaseWrapper>
      <RecordFiltersComponentInstanceContext.Provider
        value={{ instanceId: INSTANCE_ID }}
      >
        <ObjectFilterDropdownComponentInstanceContext.Provider
          value={{ instanceId: INSTANCE_ID }}
        >
          <Seed sourceFieldMetadataId={sourceFieldMetadataId}>
            <AdvancedFilterRelationTargetFieldSelectMenu
              recordFilterId={FILTER_ID}
            />
          </Seed>
          <CurrentRecordFiltersObserver />
        </ObjectFilterDropdownComponentInstanceContext.Provider>
      </RecordFiltersComponentInstanceContext.Provider>
    </BaseWrapper>,
  );
};

describe('AdvancedFilterRelationTargetFieldSelectMenu', () => {
  it.each([
    ['workspace member', workspaceMemberRelationField.id],
    ['non-workspace member', nonWorkspaceMemberRelationField.id],
  ])('shows a direct relation entry for a %s relation', async (_, fieldId) => {
    const { getByTestId } = renderSubMenu(fieldId);

    await waitFor(() => {
      expect(getByTestId('select-filter-relation-source')).toBeInTheDocument();
    });
  });

  it('creates a direct RELATION filter when the source entry is selected', async () => {
    const { getByTestId } = renderSubMenu(workspaceMemberRelationField.id);

    const sourceEntry = await waitFor(() =>
      getByTestId('select-filter-relation-source'),
    );

    fireEvent.click(sourceEntry);

    await waitFor(() => {
      const currentRecordFilters = JSON.parse(
        getByTestId('current-record-filters').textContent || '[]',
      );

      expect(currentRecordFilters).toHaveLength(1);
      expect(currentRecordFilters[0]).toMatchObject({
        fieldMetadataId: workspaceMemberRelationField.id,
        type: 'RELATION',
        relationTargetFieldMetadataId: null,
      });
    });
  });
});
