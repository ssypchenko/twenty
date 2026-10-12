import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { SettingsDatePickerInput } from '@/settings/components/SettingsDatePickerInput';
import { GET_PERMAVENT_USER_AUDIT_ENTRIES } from '@/settings/security/graphql/queries/getPermaventUserAuditEntries';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { IconBox, IconCopy, IconHistory, IconUser } from 'twenty-ui/icon';
import { Button, type SelectOption } from 'twenty-ui/input';
import { Card } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const OMITTED_VALUE = '[VALUE_OMITTED]';

type AuditEntry = {
  id: string;
  createdAt: string;
  userWorkspaceId: string | null;
  actorDisplayName: string | null;
  action: string;
  result: string;
  objectMetadataId: string | null;
  objectName: string | null;
  recordId: string | null;
  recordName: string | null;
  changedFields: string[];
  newValues: Record<string, unknown>;
  denialCategory: string | null;
};

type AuditData = {
  permaventUserAuditEntries: {
    entries: AuditEntry[];
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

type AuditFilters = {
  action: string | null;
  userWorkspaceId: string | null;
  objectMetadataId: string | null;
  recordId: string;
  from: Date | undefined;
  to: Date | undefined;
};

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledFiltersGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(3, minmax(180px, 1fr));

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPeriodField = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-column: span 2;
  grid-template-columns: 1fr 1fr;

  @media (max-width: 600px) {
    grid-column: auto;
    grid-template-columns: 1fr;
  }
`;

const StyledFieldLabel = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  grid-column: 1 / -1;
`;

const StyledAdvancedFilters = styled.details`
  color: ${themeCssVariables.font.color.secondary};

  summary {
    cursor: pointer;
    font-size: ${themeCssVariables.font.size.sm};
    font-weight: ${themeCssVariables.font.weight.medium};
    margin-bottom: ${themeCssVariables.spacing[2]};
  }
`;

const StyledAdvancedContent = styled.div`
  max-width: 360px;
`;

const StyledTableContainer = styled.div`
  overflow-x: auto;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  min-width: 900px;
  width: 100%;

  th,
  td {
    border-bottom: 1px solid ${themeCssVariables.border.color.medium};
    padding: ${themeCssVariables.spacing[3]};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${themeCssVariables.font.color.secondary};
    font-weight: ${themeCssVariables.font.weight.medium};
  }
`;

const StyledSecondaryText = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledRecordButton = styled.button`
  background: transparent;
  border: 0;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font: inherit;
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 0;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const StyledDetails = styled.details`
  min-width: 280px;

  summary {
    cursor: pointer;
  }
`;

const StyledChangeList = styled.dl`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[3]} 0 0;
`;

const StyledChange = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[1]};
  grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr);
`;

const StyledChangeName = styled.dt`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledChangeValue = styled.dd`
  margin: 0;
  overflow-wrap: anywhere;
`;

const StyledRecordDetails = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledLoadMore = styled.div`
  align-self: flex-start;
`;

const formatWorkspaceMemberName = (member: {
  name: { firstName?: string | null; lastName?: string | null };
}) => `${member.name.firstName ?? ''} ${member.name.lastName ?? ''}`.trim();

const formatAuditValue = (value: unknown): string => {
  if (value === OMITTED_VALUE) return 'Value omitted for security';
  if (value === null || value === undefined) return 'Empty';
  if (typeof value === 'string') return value || 'Empty';
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return value.map(formatAuditValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${formatAuditValue(nestedValue)}`)
      .join(', ');
  }

  return String(value);
};

export const SettingsUserActivityLog = () => {
  const { t } = useLingui();
  const { copyToClipboard } = useCopyToClipboard();
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const currentWorkspaceMembers = useAtomStateValue(
    currentWorkspaceMembersState,
  );
  const { objectMetadataItems } = useObjectMetadataItems();
  const [filters, setFilters] = useState<AuditFilters>({
    action: null,
    userWorkspaceId: null,
    objectMetadataId: null,
    recordId: '',
    from: undefined,
    to: undefined,
  });

  const buildQueryInput = (after?: string) => ({
    first: 50,
    action: filters.action ?? undefined,
    userWorkspaceId: filters.userWorkspaceId ?? undefined,
    objectMetadataId: filters.objectMetadataId ?? undefined,
    recordId: filters.recordId || undefined,
    from: filters.from,
    to: filters.to,
    after,
  });

  const { data, loading, error, fetchMore } = useQuery<AuditData>(
    GET_PERMAVENT_USER_AUDIT_ENTRIES,
    {
      variables: { input: buildQueryInput() },
      fetchPolicy: 'network-only',
    },
  );
  const connection = data?.permaventUserAuditEntries;
  const entries = connection?.entries ?? [];

  const actionOptions: SelectOption<string | null>[] = [
    { label: t`All actions`, value: null, Icon: IconHistory },
    ...[
      'CREATED',
      'UPDATED',
      'DELETED',
      'RESTORED',
      'DESTROYED',
      'UPSERTED',
      'RLS_DENIED',
    ].map((value) => ({ label: value, value, Icon: IconHistory })),
  ];
  const userOptions: SelectOption<string | null>[] = [
    { label: t`All users`, value: null, Icon: IconUser },
    ...currentWorkspaceMembers
      .filter((member) => member.userWorkspaceId)
      .map((member) => ({
        label: formatWorkspaceMemberName(member),
        value: member.userWorkspaceId ?? null,
        Icon: IconUser,
      })),
  ];
  const objectOptions: SelectOption<string | null>[] = [
    { label: t`All record types`, value: null, Icon: IconBox },
    ...objectMetadataItems
      .filter((item) => item.nameSingular !== 'permaventuserauditentry')
      .map((item) => ({
        label: item.labelPlural,
        value: item.id,
        Icon: IconBox,
      })),
  ];
  const objectMetadataById = new Map(
    objectMetadataItems.map((item) => [item.id, item]),
  );
  const actorDisplayNameByUserWorkspaceId = new Map(
    currentWorkspaceMembers
      .filter((member) => member.userWorkspaceId)
      .map((member) => [
        member.userWorkspaceId as string,
        formatWorkspaceMemberName(member),
      ]),
  );

  return (
    <StyledRoot>
      <StyledFiltersGrid>
        <Select
          dropdownId="permavent-user-audit-action-filter"
          label={t`Action`}
          value={filters.action}
          options={actionOptions}
          onChange={(action) =>
            setFilters((current) => ({ ...current, action }))
          }
          fullWidth
        />
        <Select
          dropdownId="permavent-user-audit-user-filter"
          label={t`User`}
          value={filters.userWorkspaceId}
          options={userOptions}
          onChange={(userWorkspaceId) =>
            setFilters((current) => ({ ...current, userWorkspaceId }))
          }
          fullWidth
          withSearchInput
        />
        <Select
          dropdownId="permavent-user-audit-record-type-filter"
          label={t`Record type`}
          value={filters.objectMetadataId}
          options={objectOptions}
          onChange={(objectMetadataId) =>
            setFilters((current) => ({ ...current, objectMetadataId }))
          }
          fullWidth
          withSearchInput
        />
        <StyledPeriodField>
          <StyledFieldLabel>{t`Period`}</StyledFieldLabel>
          <SettingsDatePickerInput
            instanceId="permavent-user-audit-from"
            value={filters.from}
            onChange={(from) => setFilters((current) => ({ ...current, from }))}
            placeholder={t`From date & time`}
          />
          <SettingsDatePickerInput
            instanceId="permavent-user-audit-to"
            value={filters.to}
            onChange={(to) => setFilters((current) => ({ ...current, to }))}
            placeholder={t`To date & time`}
          />
        </StyledPeriodField>
      </StyledFiltersGrid>

      <StyledAdvancedFilters>
        <summary>{t`Advanced filters`}</summary>
        <StyledAdvancedContent>
          <TextInput
            label={t`Record ID`}
            value={filters.recordId}
            onChange={(recordId) =>
              setFilters((current) => ({ ...current, recordId }))
            }
            placeholder={t`Paste a record ID`}
            fullWidth
          />
        </StyledAdvancedContent>
      </StyledAdvancedFilters>

      <Card rounded>
        {error ? (
          <p>{t`Unable to load user activity.`}</p>
        ) : loading && !data ? (
          <p>{t`Loading user activity…`}</p>
        ) : entries.length === 0 ? (
          <p>{t`No activity matches these filters.`}</p>
        ) : (
          <StyledTableContainer>
            <StyledTable>
              <thead>
                <tr>
                  <th>{t`When`}</th>
                  <th>{t`User`}</th>
                  <th>{t`Action`}</th>
                  <th>{t`Record`}</th>
                  <th>{t`Changes`}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const objectMetadata = entry.objectMetadataId
                    ? objectMetadataById.get(entry.objectMetadataId)
                    : undefined;
                  const recordLabel =
                    entry.recordName ||
                    entry.recordId ||
                    entry.objectName ||
                    '—';
                  const canOpenRecord =
                    Boolean(entry.recordId && entry.objectName) &&
                    entry.action !== 'DELETED' &&
                    entry.action !== 'DESTROYED';
                  const actorDisplayName =
                    entry.actorDisplayName ??
                    (entry.userWorkspaceId
                      ? actorDisplayNameByUserWorkspaceId.get(
                          entry.userWorkspaceId,
                        )
                      : undefined) ??
                    t`Unknown user`;

                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{actorDisplayName}</td>
                      <td>{entry.action}</td>
                      <td>
                        {canOpenRecord ? (
                          <StyledRecordButton
                            onClick={() =>
                              openRecordInSidePanel({
                                recordId: entry.recordId as string,
                                objectNameSingular: entry.objectName as string,
                              })
                            }
                          >
                            {recordLabel}
                          </StyledRecordButton>
                        ) : (
                          recordLabel
                        )}
                        <StyledSecondaryText>
                          {objectMetadata?.labelSingular ??
                            entry.objectName ??
                            '—'}
                        </StyledSecondaryText>
                        {entry.recordId && (
                          <StyledRecordDetails>
                            <Button
                              Icon={IconCopy}
                              size="small"
                              variant="tertiary"
                              ariaLabel={t`Copy record ID`}
                              onClick={() =>
                                copyToClipboard(
                                  entry.recordId as string,
                                  t`Record ID copied`,
                                )
                              }
                            />
                            <Button
                              title={t`Show only this record`}
                              size="small"
                              variant="tertiary"
                              onClick={() =>
                                setFilters((current) => ({
                                  ...current,
                                  recordId: entry.recordId as string,
                                }))
                              }
                            />
                          </StyledRecordDetails>
                        )}
                      </td>
                      <td>
                        {entry.changedFields.length > 0 ? (
                          <StyledDetails>
                            <summary>
                              {t`${entry.changedFields.length} changed field(s)`}
                            </summary>
                            <StyledChangeList>
                              {entry.changedFields.map((field) => (
                                <StyledChange key={field}>
                                  <StyledChangeName>
                                    {objectMetadata?.fields.find(
                                      (item) => item.name === field,
                                    )?.label ?? field}
                                  </StyledChangeName>
                                  <StyledChangeValue>
                                    {formatAuditValue(entry.newValues[field])}
                                  </StyledChangeValue>
                                </StyledChange>
                              ))}
                            </StyledChangeList>
                          </StyledDetails>
                        ) : (
                          (entry.denialCategory ?? '—')
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </StyledTableContainer>
        )}
      </Card>
      {connection?.hasNextPage && connection.endCursor && (
        <StyledLoadMore>
          <Button
            title={t`Load more`}
            onClick={() =>
              fetchMore({
                variables: {
                  input: buildQueryInput(connection.endCursor ?? undefined),
                },
                updateQuery: (previous, { fetchMoreResult }) => ({
                  permaventUserAuditEntries: {
                    ...fetchMoreResult.permaventUserAuditEntries,
                    entries: [
                      ...previous.permaventUserAuditEntries.entries,
                      ...fetchMoreResult.permaventUserAuditEntries.entries,
                    ],
                  },
                }),
              })
            }
          />
        </StyledLoadMore>
      )}
    </StyledRoot>
  );
};
