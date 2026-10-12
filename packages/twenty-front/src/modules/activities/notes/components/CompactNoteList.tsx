import { type Note } from '@/activities/types/Note';
import { getActivityPreview } from '@/activities/utils/getActivityPreview';
import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { UserContext } from '@/users/contexts/UserContext';
import { styled } from '@linaria/react';
import { type ReactElement, useContext } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { dateLocaleState } from '~/localization/states/dateLocaleState';
import { formatDateTimeString } from '~/utils/string/formatDateTimeString';

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[6]};
`;

const StyledCount = styled.span`
  color: ${themeCssVariables.font.color.light};
`;

const StyledList = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
`;

const StyledRow = styled.button`
  align-items: start;
  background: transparent;
  border: 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: inherit;
  cursor: pointer;
  display: grid;
  font: inherit;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: 160px minmax(0, 1fr);
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[6]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.border.color.strong};
    outline-offset: -2px;
  }
`;

const StyledDate = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  white-space: nowrap;
`;

const StyledBody = styled.span`
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: ${themeCssVariables.font.color.primary};
  display: -webkit-box;
  line-break: anywhere;
  overflow: hidden;
`;

type CompactNoteListProps = {
  notes: Note[];
  totalCount: number;
  button?: ReactElement | false | null;
};

export const CompactNoteList = ({
  notes,
  totalCount,
  button,
}: CompactNoteListProps) => {
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const { dateFormat, timeFormat, timeZone } = useContext(UserContext);
  const { localeCatalog } = useAtomStateValue(dateLocaleState);
  const { formatNumber } = useNumberFormat();

  return (
    <>
      <StyledHeader>
        <StyledCount>{formatNumber(totalCount)}</StyledCount>
        {button}
      </StyledHeader>
      <StyledList>
        {notes.map((note) => (
          <StyledRow
            key={note.id}
            type="button"
            onClick={() =>
              openRecordInSidePanel({
                recordId: note.id,
                objectNameSingular: CoreObjectNameSingular.Note,
              })
            }
          >
            <StyledDate>
              {formatDateTimeString({
                value: note.createdAt,
                timeZone,
                dateFormat,
                timeFormat,
                localeCatalog,
              })}
            </StyledDate>
            <StyledBody>
              {getActivityPreview(note.bodyV2?.blocknote ?? null)}
            </StyledBody>
          </StyledRow>
        ))}
      </StyledList>
    </>
  );
};
