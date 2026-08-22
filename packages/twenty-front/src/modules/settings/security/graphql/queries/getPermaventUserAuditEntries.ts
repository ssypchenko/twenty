import { gql } from '@apollo/client';

export const GET_PERMAVENT_USER_AUDIT_ENTRIES = gql`
  query PermaventUserAuditEntries($input: PermaventUserAuditQueryInput!) {
    permaventUserAuditEntries(input: $input) {
      entries {
        id
        createdAt
        actorDisplayName
        action
        result
        objectName
        recordId
        recordName
        changedFields
        newValues
        denialCategory
      }
      endCursor
      hasNextPage
    }
  }
`;
