import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';

export const mergePermaventSecurityFilter = ({
  callerFilter,
  securityFilter,
}: {
  callerFilter: ObjectRecordFilter | undefined;
  securityFilter: ObjectRecordFilter;
}): ObjectRecordFilter => {
  if (callerFilter === undefined || Object.keys(callerFilter).length === 0) {
    return securityFilter;
  }

  return {
    and: [callerFilter, securityFilter],
  };
};
