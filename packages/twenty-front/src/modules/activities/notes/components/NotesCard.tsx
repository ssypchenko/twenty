import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { CompactNoteList } from '@/activities/notes/components/CompactNoteList';
import { NoteList } from '@/activities/notes/components/NoteList';
import { useNotes } from '@/activities/notes/hooks/useNotes';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/feedback';
import { IconPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledNotesContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

const StyledCompactEmptyContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[6]};
`;

type NotesCardProps = {
  isCompact?: boolean;
};

export const NotesCard = ({ isCompact = false }: NotesCardProps) => {
  const targetRecord = useTargetRecord();
  const { notes, loading, totalCountNotes, fetchMoreNotes, hasNextPage } =
    useNotes(targetRecord);

  const handleLastRowVisible = async () => {
    if (hasNextPage) {
      await fetchMoreNotes();
    }
  };

  const openCreateActivity = useOpenCreateActivityDrawer({
    activityObjectNameSingular: CoreObjectNameSingular.Note,
  });

  const isNotesEmpty = notes.length === 0;

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const objectPermissions = useObjectPermissionsForObject(
    objectMetadataItem.id,
  );

  const hasObjectUpdatePermissions = objectPermissions.canUpdateObjectRecords;

  if (loading && isNotesEmpty) {
    return <SkeletonLoader />;
  }

  if (isNotesEmpty) {
    if (isCompact) {
      return (
        <StyledCompactEmptyContainer>
          <span>{t`No notes`}</span>
          {hasObjectUpdatePermissions && (
            <Button
              Icon={IconPlus}
              size="small"
              variant="secondary"
              title={t`Add note`}
              onClick={() =>
                openCreateActivity({
                  targetableObjects: [targetRecord],
                })
              }
            />
          )}
        </StyledCompactEmptyContainer>
      );
    }

    return (
      <AnimatedPlaceholderEmptyContainer>
        <AnimatedPlaceholder type="noNote" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>
            {t`No notes`}
          </AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
            {t`There are no associated notes with this record.`}
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
        {hasObjectUpdatePermissions && (
          <Button
            Icon={IconPlus}
            title={t`New note`}
            variant="secondary"
            onClick={() =>
              openCreateActivity({
                targetableObjects: [targetRecord],
              })
            }
          />
        )}
      </AnimatedPlaceholderEmptyContainer>
    );
  }

  return (
    <StyledNotesContainer>
      {isCompact ? (
        <CompactNoteList
          notes={notes}
          totalCount={totalCountNotes}
          button={
            hasObjectUpdatePermissions && (
              <Button
                Icon={IconPlus}
                size="small"
                variant="secondary"
                title={t`Add note`}
                onClick={() =>
                  openCreateActivity({
                    targetableObjects: [targetRecord],
                  })
                }
              />
            )
          }
        />
      ) : (
        <NoteList
          title={t`All`}
          notes={notes}
          totalCount={totalCountNotes}
          button={
            hasObjectUpdatePermissions && (
              <Button
                Icon={IconPlus}
                size="small"
                variant="secondary"
                title={t`Add note`}
                onClick={() =>
                  openCreateActivity({
                    targetableObjects: [targetRecord],
                  })
                }
              />
            )
          }
        />
      )}
      <CustomResolverFetchMoreLoader
        loading={loading}
        onLastRowVisible={handleLastRowVisible}
      />
    </StyledNotesContainer>
  );
};
