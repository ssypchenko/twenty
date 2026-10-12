import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

const MCP_READ_ONLY_DATABASE_OPERATIONS = new Set([
  'find_one',
  'find_many',
  'group_by',
]);

export const isMcpReadOnlyCatalogTool = (entry: ToolIndexEntry): boolean =>
  entry.category === ToolCategory.DATABASE_CRUD &&
  typeof entry.operation === 'string' &&
  MCP_READ_ONLY_DATABASE_OPERATIONS.has(entry.operation);
