import { ToolCategory } from 'twenty-shared/ai';

import { isMcpReadOnlyCatalogTool } from 'src/engine/api/mcp/utils/is-mcp-read-only-catalog-tool.util';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

const entry = (category: ToolCategory, operation: string): ToolIndexEntry =>
  ({
    name: 'tool',
    description: 'Test tool',
    category,
    operation,
  }) as ToolIndexEntry;

describe('isMcpReadOnlyCatalogTool', () => {
  it.each(['find_one', 'find_many', 'group_by'])(
    'allows the %s database operation',
    (operation) => {
      expect(
        isMcpReadOnlyCatalogTool(entry(ToolCategory.DATABASE_CRUD, operation)),
      ).toBe(true);
    },
  );

  it('denies database mutations and non-database tools', () => {
    expect(
      isMcpReadOnlyCatalogTool(entry(ToolCategory.DATABASE_CRUD, 'create_one')),
    ).toBe(false);
    expect(
      isMcpReadOnlyCatalogTool(entry(ToolCategory.ACTION, 'find_many')),
    ).toBe(false);
  });
});
