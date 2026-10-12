const PERMAVENT_SALES_REP_CODE_PATTERN = /^[A-Z]{2,32}$/;

export const normalisePermaventSalesRepCode = (
  salesRepCode: string,
): string => {
  const normalisedSalesRepCode = salesRepCode.trim().toUpperCase();

  if (!PERMAVENT_SALES_REP_CODE_PATTERN.test(normalisedSalesRepCode)) {
    throw new Error(
      'A Sales Rep code must contain between two and 32 uppercase letters.',
    );
  }

  return normalisedSalesRepCode;
};
