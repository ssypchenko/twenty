export type PermaventSalesScope =
  | {
      mode: 'ALL';
      salesRepCodes: [];
    }
  | {
      mode: 'ASSIGNED';
      salesRepCodes: string[];
    }
  | {
      mode: 'NONE';
      salesRepCodes: [];
    };
