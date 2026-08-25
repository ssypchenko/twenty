export type PermaventSalesScope =
  | {
      mode: 'ALL';
      salesRepCodes: [];
    }
  | {
      mode: 'ASSIGNED';
      salesRepCodes: string[];
      primarySalesRepCode: string | null;
    }
  | {
      mode: 'NONE';
      salesRepCodes: [];
    };
