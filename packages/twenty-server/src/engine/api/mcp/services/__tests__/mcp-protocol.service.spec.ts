import { McpProtocolService } from 'src/engine/api/mcp/services/mcp-protocol.service';
import { McpToolAccess } from 'src/engine/core-modules/auth/types/mcp-tool-access.type';

describe('McpProtocolService', () => {
  it('applies the read-only catalog restriction for an internal MCP token', async () => {
    const toolRegistry = {
      getToolsByName: jest.fn().mockResolvedValue({}),
      buildToolIndex: jest.fn().mockResolvedValue([]),
    };
    const mcpToolExecutorService = {
      handleToolsListing: jest.fn().mockReturnValue({}),
    };

    const service = new McpProtocolService(
      toolRegistry as never,
      {} as never,
      mcpToolExecutorService as never,
      {
        getRoleIdForApiKeyId: jest.fn().mockResolvedValue('role-1'),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.handleMCPCoreQuery(
      { jsonrpc: '2.0', id: 'request-1', method: 'tools/list' },
      {
        workspace: { id: 'workspace-1' } as never,
        apiKey: {
          id: 'api-key-1',
          name: 'Internal MCP token',
        } as never,
        mcpToolAccess: McpToolAccess.READ_ONLY,
      },
    );

    expect(toolRegistry.buildToolIndex).toHaveBeenCalledWith(
      'workspace-1',
      'role-1',
      { userId: undefined, userWorkspaceId: undefined },
    );
  });
});
