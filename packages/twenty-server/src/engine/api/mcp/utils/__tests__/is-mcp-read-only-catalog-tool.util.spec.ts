import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { isMcpReadOnlyCatalogTool } from 'src/engine/api/mcp/utils/is-mcp-read-only-catalog-tool.util';

const makeToolIndexEntry = (
  operation: string | undefined,
  category = ToolCategory.DATABASE_CRUD,
): ToolIndexEntry =>
  ({
    name: `${operation ?? 'unknown'}_companies`,
    label: 'Companies',
    description: 'Test tool',
    category,
    operation,
    executionRef: {
      kind: 'database_crud',
      objectNameSingular: 'company',
      operation: 'find_many',
    },
  }) as ToolIndexEntry;

describe('isMcpReadOnlyCatalogTool', () => {
  it.each(['find_one', 'find_many', 'group_by'])(
    'should allow the %s database operation',
    (operation) => {
      expect(isMcpReadOnlyCatalogTool(makeToolIndexEntry(operation))).toBe(
        true,
      );
    },
  );

  it.each(['create', 'update', 'upsert', 'delete', undefined])(
    'should deny the %s database operation',
    (operation) => {
      expect(isMcpReadOnlyCatalogTool(makeToolIndexEntry(operation))).toBe(
        false,
      );
    },
  );

  it('should deny a non-database tool even when its name looks read-only', () => {
    expect(
      isMcpReadOnlyCatalogTool(
        makeToolIndexEntry('find_many', ToolCategory.ACTION),
      ),
    ).toBe(false);
  });
});
