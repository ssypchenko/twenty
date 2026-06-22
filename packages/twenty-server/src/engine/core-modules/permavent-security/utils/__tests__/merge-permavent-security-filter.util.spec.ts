import { mergePermaventSecurityFilter } from 'src/engine/core-modules/permavent-security/utils/merge-permavent-security-filter.util';

describe('mergePermaventSecurityFilter', () => {
  const securityFilter = {
    erpsalesrepcode: { in: ['DM'] },
  };

  it('should return only the security filter without a caller filter', () => {
    expect(
      mergePermaventSecurityFilter({
        callerFilter: undefined,
        securityFilter,
      }),
    ).toBe(securityFilter);
  });

  it('should combine caller and security filters with and', () => {
    const callerFilter = { name: { ilike: '%example%' } };

    expect(
      mergePermaventSecurityFilter({ callerFilter, securityFilter }),
    ).toEqual({
      and: [callerFilter, securityFilter],
    });
  });
});
