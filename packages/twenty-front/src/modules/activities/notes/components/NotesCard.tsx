import { useCreateActivityForTargetRecord } from '@/activities/hooks/useCreateActivityForTargetRecord';
import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { CompactNoteList } from '@/activities/notes/components/CompactNoteList';
import { NotesCardContent } from '@/activities/notes/components/NotesCardContent';
import { useNotes } from '@/activities/notes/hooks/useNotes';
import { WidgetHeaderCountEffect } from '@/page-layout/widgets/components/WidgetHeaderCountEffect';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { CoreObjectNameSingular } from 'twenty-shared/types';
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

  const { canCreateActivity, createActivity } =
    useCreateActivityForTargetRecord({
      targetRecord,
      activityObjectNameSingular: CoreObjectNameSingular.Note,
    });

  const isNotesEmpty = notes.length === 0;

  if (loading && isNotesEmpty) {
    return <SkeletonLoader />;
  }

  return (
    <>
      <WidgetHeaderCountEffect count={totalCountNotes} />
      {isCompact ? (
        isNotesEmpty ? (
          <StyledCompactEmptyContainer>
            <span>{t`No notes`}</span>
            {canCreateActivity && (
              <Button
                Icon={IconPlus}
                size="small"
                title={t`New note`}
                variant="secondary"
                onClick={createActivity}
              />
            )}
          </StyledCompactEmptyContainer>
        ) : (
          <StyledNotesContainer>
            <CompactNoteList
              notes={notes}
              totalCount={totalCountNotes}
              button={
                canCreateActivity && (
                  <Button
                    Icon={IconPlus}
                    size="small"
                    title={t`New note`}
                    variant="secondary"
                    onClick={createActivity}
                  />
                )
              }
            />
            <CustomResolverFetchMoreLoader
              loading={loading}
              onLastRowVisible={handleLastRowVisible}
            />
          </StyledNotesContainer>
        )
      ) : (
        <NotesCardContent
          loading={loading}
          notes={notes}
          onCreateNote={canCreateActivity ? createActivity : undefined}
          onLastRowVisible={handleLastRowVisible}
        />
      )}
    </>
  );
};
