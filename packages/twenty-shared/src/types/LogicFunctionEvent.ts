import { type PermaventLogicFunctionActorContext } from './PermaventLogicFunctionActorContext';
import { type PermaventSalesScope } from './PermaventSalesScope';

export type LogicFunctionEvent<TBody = object> = {
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined>;
  pathParameters: Record<string, string | undefined>;
  body: TBody | null;
  rawBody?: string;
  isBase64Encoded: boolean;
  requestContext: {
    http: {
      method: string;
      path: string;
    };
  };
  // Populated for HTTP-route triggers with `isAuthRequired: true`. null
  // when the trigger fires without a user (cron, database events) or when
  // auth is disabled.
  userWorkspaceId: string | null;
  // Resolved by the Permavent server for authenticated HTTP routes. The
  // request body, query string and forwarded headers cannot override it.
  permaventSalesScope?: PermaventSalesScope | null;
  // Server-derived actor identity for authenticated Permavent application
  // routes. Request input and forwarded headers cannot override it.
  permaventActorContext?: PermaventLogicFunctionActorContext | null;
};
