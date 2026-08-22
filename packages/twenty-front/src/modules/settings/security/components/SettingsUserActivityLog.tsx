import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { GET_PERMAVENT_USER_AUDIT_ENTRIES } from '@/settings/security/graphql/queries/getPermaventUserAuditEntries';
import { useQuery } from '@apollo/client/react';
import { Button } from 'twenty-ui/input';
import { Card } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type AuditEntry = {
  id: string;
  createdAt: string;
  actorDisplayName: string | null;
  action: string;
  result: string;
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

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;
const StyledFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  input,
  select {
    min-height: 32px;
    padding: 0 ${themeCssVariables.spacing[2]};
  }
`;
const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  th,
  td {
    border-bottom: 1px solid ${themeCssVariables.border.color.medium};
    padding: ${themeCssVariables.spacing[2]};
    text-align: left;
    vertical-align: top;
  }
  th {
    color: ${themeCssVariables.font.color.secondary};
    font-weight: 500;
  }
`;
const StyledDetails = styled.details`
  max-width: 360px;
  white-space: pre-wrap;
`;

export const SettingsUserActivityLog = () => {
  const { t } = useLingui();
  const [action, setAction] = useState('');
  const [objectName, setObjectName] = useState('');
  const [recordId, setRecordId] = useState('');
  const { data, loading, error, fetchMore } = useQuery<AuditData>(
    GET_PERMAVENT_USER_AUDIT_ENTRIES,
    {
      variables: {
        input: {
          first: 50,
          action: action || undefined,
          objectName: objectName || undefined,
          recordId: recordId || undefined,
        },
      },
      fetchPolicy: 'network-only',
    },
  );
  const connection = data?.permaventUserAuditEntries;
  const entries = connection?.entries ?? [];

  return (
    <StyledRoot>
      <StyledFilters>
        <select
          aria-label={t`Action`}
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value="">{t`All actions`}</option>
          {[
            'CREATED',
            'UPDATED',
            'DELETED',
            'RESTORED',
            'DESTROYED',
            'UPSERTED',
            'RLS_DENIED',
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          aria-label={t`Object`}
          value={objectName}
          onChange={(event) => setObjectName(event.target.value)}
          placeholder={t`Object type`}
        />
        <input
          aria-label={t`Record ID`}
          value={recordId}
          onChange={(event) => setRecordId(event.target.value)}
          placeholder={t`Record ID`}
        />
      </StyledFilters>
      <Card rounded>
        {error ? (
          <p>{t`Unable to load user activity.`}</p>
        ) : loading && !data ? (
          <p>{t`Loading user activity…`}</p>
        ) : entries.length === 0 ? (
          <p>{t`No activity matches these filters.`}</p>
        ) : (
          <StyledTable>
            <thead>
              <tr>
                <th>{t`When`}</th>
                <th>{t`Action`}</th>
                <th>{t`Record`}</th>
                <th>{t`Changes`}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.action}</td>
                  <td>
                    {entry.recordName ??
                      entry.recordId ??
                      entry.objectName ??
                      '—'}
                  </td>
                  <td>
                    {entry.changedFields.length > 0 ? (
                      <StyledDetails>
                        <summary>{entry.changedFields.join(', ')}</summary>
                        {JSON.stringify(entry.newValues, null, 2)}
                      </StyledDetails>
                    ) : (
                      (entry.denialCategory ?? '—')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        )}
      </Card>
      {connection?.hasNextPage && connection.endCursor && (
        <Button
          title={t`Load more`}
          onClick={() =>
            fetchMore({
              variables: {
                input: {
                  first: 50,
                  action: action || undefined,
                  objectName: objectName || undefined,
                  recordId: recordId || undefined,
                  after: connection.endCursor,
                },
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
      )}
    </StyledRoot>
  );
};
