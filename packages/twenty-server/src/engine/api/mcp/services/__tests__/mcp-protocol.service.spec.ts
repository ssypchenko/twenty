import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ToolCategory } from 'twenty-shared/ai';
import { FieldActorSource } from 'twenty-shared/types';

import { JSON_RPC_ERROR_CODE } from 'src/engine/api/mcp/constants/json-rpc-error-code.const';
import { MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS } from 'src/engine/api/mcp/constants/mcp-closed-world-read-only-tool-annotations.const';
import { MCP_EXECUTE_TOOL_ANNOTATIONS } from 'src/engine/api/mcp/constants/mcp-execute-tool-annotations.const';
import { MCP_OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS } from 'src/engine/api/mcp/constants/mcp-open-world-read-only-tool-annotations.const';
import { MCP_PROTOCOL_VERSION } from 'src/engine/api/mcp/constants/mcp-protocol-version.const';
import { MCP_SERVER_INFO } from 'src/engine/api/mcp/constants/mcp-server-info.const';
import { type JsonRpc } from 'src/engine/api/mcp/dtos/json-rpc';
import { McpInstructionBuilderService } from 'src/engine/api/mcp/services/mcp-instruction-builder.service';
import { McpProtocolService } from 'src/engine/api/mcp/services/mcp-protocol.service';
import { McpToolExecutorService } from 'src/engine/api/mcp/services/mcp-tool-executor.service';
import { LIST_OBJECT_METADATA_NAMES_TOOL_NAME } from 'src/engine/api/mcp/tools/list-object-metadata-names.tool';
import { LIST_SKILLS_TOOL_NAME } from 'src/engine/api/mcp/tools/list-skills.tool';
import { type McpToolAnnotations } from 'src/engine/api/mcp/types/mcp-tool-annotations.type';
import { type FlatApiKey } from 'src/engine/core-modules/api-key/types/flat-api-key.type';
import { ApiKeyRoleService } from 'src/engine/core-modules/api-key/services/api-key-role.service';
import { McpToolAccess } from 'src/engine/core-modules/auth/types/mcp-tool-access.type';
import { EXECUTE_TOOL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/execute-tool.tool';
import { GET_TOOL_CATALOG_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/get-tool-catalog.tool';
import { LEARN_TOOLS_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/learn-tools.tool';
import { LOAD_SKILL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { SkillService } from 'src/engine/metadata-modules/skill/skill.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

describe('McpProtocolService', () => {
  let service: McpProtocolService;
  let _toolRegistryService: jest.Mocked<ToolRegistryService>;
  let userRoleService: jest.Mocked<UserRoleService>;
  let mcpToolExecutorService: jest.Mocked<McpToolExecutorService>;
  let apiKeyRoleService: jest.Mocked<ApiKeyRoleService>;

  const mockWorkspace = { id: 'workspace-1' } as FlatWorkspace;
  const mockUserWorkspaceId = 'user-workspace-1';
  const mockRoleId = 'role-1';
  const mockAdminRoleId = 'admin-role-1';
  const mockApiKey = {
    id: 'api-key-1',
    workspaceId: mockWorkspace.id,
  } as FlatApiKey;

  const EXPECTED_MCP_TOOL_NAMES = [
    LEARN_TOOLS_TOOL_NAME,
    EXECUTE_TOOL_TOOL_NAME,
    GET_TOOL_CATALOG_TOOL_NAME,
    LOAD_SKILL_TOOL_NAME,
    LIST_OBJECT_METADATA_NAMES_TOOL_NAME,
    LIST_SKILLS_TOOL_NAME,
    'search_help_center',
  ] as const;

  const EXPECTED_MCP_TOOL_ANNOTATIONS: Record<
    (typeof EXPECTED_MCP_TOOL_NAMES)[number],
    McpToolAnnotations
  > = {
    [LEARN_TOOLS_TOOL_NAME]: MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
    [EXECUTE_TOOL_TOOL_NAME]: MCP_EXECUTE_TOOL_ANNOTATIONS,
    [GET_TOOL_CATALOG_TOOL_NAME]: MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
    [LOAD_SKILL_TOOL_NAME]: MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
    [LIST_OBJECT_METADATA_NAMES_TOOL_NAME]:
      MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
    [LIST_SKILLS_TOOL_NAME]: MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
    search_help_center: MCP_OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
  };

  beforeEach(async () => {
    const mockSearchHelpCenterTool = {
      description: 'Search help center',
      inputSchema: { jsonSchema: { type: 'object' } },
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpProtocolService,
        {
          provide: ToolRegistryService,
          useValue: {
            buildToolIndex: jest.fn().mockResolvedValue([]),
            getToolsByName: jest.fn().mockResolvedValue({
              search_help_center: mockSearchHelpCenterTool,
            }),
            getToolInfo: jest.fn().mockResolvedValue([]),
            suggestSimilarToolNames: jest.fn().mockResolvedValue({}),
            resolveAndExecute: jest.fn(),
          },
        },
        {
          provide: UserRoleService,
          useValue: { getRoleIdForUserWorkspace: jest.fn() },
        },
        {
          provide: McpToolExecutorService,
          useValue: {
            handleToolCall: jest.fn(),
            handleToolsListing: jest.fn(),
          },
        },
        {
          provide: ApiKeyRoleService,
          useValue: {
            getRoleIdForApiKeyId: jest.fn().mockResolvedValue(mockAdminRoleId),
          },
        },
        {
          provide: SkillService,
          useValue: {
            findFlatSkillsByNames: jest.fn().mockResolvedValue([]),
            findAllFlatSkills: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: McpInstructionBuilderService,
          useValue: {
            buildInstructions: jest.fn().mockResolvedValue('mock instructions'),
          },
        },
        {
          provide: WorkspaceManyOrAllFlatEntityMapsCacheService,
          useValue: {
            getOrRecomputeManyOrAllFlatEntityMaps: jest.fn().mockResolvedValue({
              flatObjectMetadataMaps: { byUniversalIdentifier: {} },
            }),
          },
        },
        {
          provide: WorkspaceCacheService,
          useValue: {
            getOrRecompute: jest.fn().mockResolvedValue({
              flatWorkspaceMemberMaps: {
                idByUserId: {},
                byId: {},
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<McpProtocolService>(McpProtocolService);
    _toolRegistryService = module.get(ToolRegistryService);
    userRoleService = module.get(UserRoleService);
    mcpToolExecutorService = module.get(McpToolExecutorService);
    apiKeyRoleService = module.get(ApiKeyRoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleInitialize', () => {
    it('should return spec-compliant initialization response', async () => {
      const requestId = '123';
      const result = await service.handleInitialize(
        requestId,
        mockWorkspace.id,
      );

      expect(result).toEqual({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: MCP_SERVER_INFO,
          instructions: expect.any(String),
        },
      });
    });
  });

  describe('getRoleId', () => {
    it('should return role ID when available', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      const result = await service.getRoleId('workspace-1', 'user-workspace-1');

      expect(result).toBe(mockRoleId);
      expect(userRoleService.getRoleIdForUserWorkspace).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        userWorkspaceId: 'user-workspace-1',
      });
    });

    it('should throw when userWorkspaceId is missing and no apiKey is provided', async () => {
      await expect(service.getRoleId('workspace-1', undefined)).rejects.toThrow(
        new HttpException('User workspace ID missing', HttpStatus.FORBIDDEN),
      );
    });

    it('should throw when role ID is missing', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(
        undefined as unknown as string,
      );

      await expect(
        service.getRoleId('workspace-1', 'user-workspace-1'),
      ).rejects.toThrow(
        new HttpException('Role ID missing', HttpStatus.FORBIDDEN),
      );
    });

    it('should return role ID from ApiKeyRoleService when apiKey is provided', async () => {
      const result = await service.getRoleId(
        'workspace-1',
        undefined,
        mockApiKey,
      );

      expect(result).toBe(mockAdminRoleId);
      expect(apiKeyRoleService.getRoleIdForApiKeyId).toHaveBeenCalledWith(
        mockApiKey.id,
        'workspace-1',
      );
    });
  });

  describe('handleMCPCoreQuery', () => {
    it('should handle initialize method', async () => {
      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: MCP_SERVER_INFO,
          instructions: expect.any(String),
        },
      });
    });

    it('should return null for notifications (no id)', async () => {
      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toBeNull();
    });

    it('should build the meta-tool set by name and pass it to executor for tools/call', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      const mockToolCallResponse = {
        id: '123',
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: '{}' }],
          isError: false,
        },
      };

      mcpToolExecutorService.handleToolCall.mockResolvedValue(
        mockToolCallResponse,
      );

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'execute_tool',
          arguments: { toolName: 'find_many_companies', arguments: {} },
        },
        id: '123',
      };

      await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(mcpToolExecutorService.handleToolCall).toHaveBeenCalledWith(
        '123',
        expect.objectContaining(
          Object.fromEntries(
            EXPECTED_MCP_TOOL_NAMES.map((name) => [
              name,
              expect.objectContaining({
                description: expect.any(String),
                annotations: EXPECTED_MCP_TOOL_ANNOTATIONS[name],
                execute: expect.any(Function),
              }),
            ]),
          ),
        ),
        mockRequest.params,
        undefined,
      );

      const [, toolSet] = mcpToolExecutorService.handleToolCall.mock.calls[0];

      expect(Object.keys(toolSet).sort()).toEqual(
        [...EXPECTED_MCP_TOOL_NAMES].sort(),
      );

      const executeTool = toolSet[EXECUTE_TOOL_TOOL_NAME]
        .execute as unknown as (parameters: {
        toolName: string;
        arguments: Record<string, unknown>;
      }) => Promise<unknown>;

      await executeTool({
        toolName: 'update_company',
        arguments: { id: 'company-1' },
      });

      expect(_toolRegistryService.resolveAndExecute).toHaveBeenCalledWith(
        'update_company',
        { id: 'company-1' },
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should build the meta-tool set by name and pass it to executor for tools/list', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      mcpToolExecutorService.handleToolsListing.mockReturnValue({
        id: '123',
        jsonrpc: '2.0',
        result: { tools: [] },
      });

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: '123',
      };

      await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(mcpToolExecutorService.handleToolsListing).toHaveBeenCalledWith(
        '123',
        expect.objectContaining(
          Object.fromEntries(
            EXPECTED_MCP_TOOL_NAMES.map((name) => [
              name,
              expect.objectContaining({
                description: expect.any(String),
                annotations: EXPECTED_MCP_TOOL_ANNOTATIONS[name],
              }),
            ]),
          ),
        ),
      );

      const [, toolSet] =
        mcpToolExecutorService.handleToolsListing.mock.calls[0];

      expect(Object.keys(toolSet).sort()).toEqual(
        [...EXPECTED_MCP_TOOL_NAMES].sort(),
      );
    });

    it('should expose and execute only read-only database tools for a read-only MCP token', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      const catalog = [
        {
          name: 'find_many_companies',
          category: ToolCategory.DATABASE_CRUD,
          operation: 'find_many',
        },
        {
          name: 'group_by_companies',
          category: ToolCategory.DATABASE_CRUD,
          operation: 'group_by',
        },
        {
          name: 'update_company',
          category: ToolCategory.DATABASE_CRUD,
          operation: 'update',
        },
        {
          name: 'find_many_external_records',
          category: ToolCategory.ACTION,
          operation: 'find_many',
        },
      ].map(
        (entry) =>
          ({
            ...entry,
            label: entry.name,
            description: entry.name,
            executionRef: {
              kind: 'database_crud',
              objectNameSingular: 'company',
              operation: 'find_many',
            },
          }) as ToolIndexEntry,
      );

      _toolRegistryService.buildToolIndex.mockResolvedValue(catalog);
      _toolRegistryService.resolveAndExecute.mockResolvedValue({
        success: true,
        message: 'Read completed',
      });
      mcpToolExecutorService.handleToolsListing.mockReturnValue({
        id: '123',
        jsonrpc: '2.0',
        result: { tools: [] },
      });

      await service.handleMCPCoreQuery(
        { jsonrpc: '2.0', method: 'tools/list', id: '123' },
        {
          workspace: mockWorkspace,
          userWorkspaceId: mockUserWorkspaceId,
          apiKey: undefined,
          mcpToolAccess: McpToolAccess.READ_ONLY,
        },
      );

      const [, toolSet] =
        mcpToolExecutorService.handleToolsListing.mock.calls[0];

      const executeToolAnnotations = (
        toolSet[EXECUTE_TOOL_TOOL_NAME] as unknown as {
          annotations: McpToolAnnotations;
        }
      ).annotations;

      expect(executeToolAnnotations).toEqual(
        MCP_CLOSED_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
      );

      const executeCatalog = toolSet[GET_TOOL_CATALOG_TOOL_NAME]
        .execute as unknown as (parameters: {
        categories?: string[];
      }) => Promise<{
        catalog: Record<string, Array<{ name: string }>>;
      }>;
      const catalogResult = await executeCatalog({});

      expect(
        Object.values(catalogResult.catalog)
          .flat()
          .map(({ name }) => name)
          .sort(),
      ).toEqual(['find_many_companies', 'group_by_companies']);

      const learnTools = toolSet[LEARN_TOOLS_TOOL_NAME]
        .execute as unknown as (parameters: {
        toolNames: string[];
        aspects: Array<'description' | 'schema'>;
      }) => Promise<unknown>;

      await learnTools({
        toolNames: ['find_many_companies', 'update_company'],
        aspects: ['schema'],
      });

      expect(_toolRegistryService.getToolInfo).toHaveBeenCalledWith(
        ['find_many_companies'],
        expect.any(Object),
        ['schema'],
      );

      const executeTool = toolSet[EXECUTE_TOOL_TOOL_NAME]
        .execute as unknown as (parameters: {
        toolName: string;
        arguments: Record<string, unknown>;
      }) => Promise<{ success: boolean }>;

      await expect(
        executeTool({ toolName: 'update_company', arguments: {} }),
      ).resolves.toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
      expect(_toolRegistryService.resolveAndExecute).not.toHaveBeenCalled();

      await expect(
        executeTool({ toolName: 'find_many_companies', arguments: {} }),
      ).resolves.toEqual(
        expect.objectContaining({
          success: true,
        }),
      );
      expect(_toolRegistryService.resolveAndExecute).toHaveBeenCalledWith(
        'find_many_companies',
        {},
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should pass actorContext with FieldActorSource.AGENT to getToolsByName', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: '123',
      };

      await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(_toolRegistryService.getToolsByName).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          actorContext: expect.objectContaining({
            source: FieldActorSource.AGENT,
          }),
        }),
      );
    });

    it('should return prompts list without role resolution', async () => {
      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'prompts/list',
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        result: { prompts: [] },
      });
      expect(userRoleService.getRoleIdForUserWorkspace).not.toHaveBeenCalled();
    });

    it('should return resources list without role resolution', async () => {
      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'resources/list',
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        result: { resources: [] },
      });
      expect(userRoleService.getRoleIdForUserWorkspace).not.toHaveBeenCalled();
    });

    it('should return method not found for unknown methods', async () => {
      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'unknown/method',
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        error: {
          code: JSON_RPC_ERROR_CODE.METHOD_NOT_FOUND,
          message: "Method 'unknown/method' not found",
        },
      });
    });

    it('should handle tools/call with apiKey authentication', async () => {
      const mockToolCallResponse = {
        id: '123',
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: '{}' }], isError: false },
      };

      mcpToolExecutorService.handleToolCall.mockResolvedValue(
        mockToolCallResponse,
      );

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'execute_tool', arguments: {} },
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        apiKey: mockApiKey,
      });

      expect(result).toEqual(mockToolCallResponse);
      expect(apiKeyRoleService.getRoleIdForApiKeyId).toHaveBeenCalledWith(
        mockApiKey.id,
        mockWorkspace.id,
      );
    });

    it('should wrap unexpected errors with INTERNAL_ERROR code', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockResolvedValue(mockRoleId);

      mcpToolExecutorService.handleToolCall.mockRejectedValue(
        new Error('Something went wrong'),
      );

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'execute_tool', arguments: {} },
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        error: {
          code: JSON_RPC_ERROR_CODE.INTERNAL_ERROR,
          message: 'Something went wrong',
        },
      });
    });

    it('should wrap HttpException errors with SERVER_ERROR code', async () => {
      userRoleService.getRoleIdForUserWorkspace.mockRejectedValue(
        new HttpException('Role ID missing', HttpStatus.FORBIDDEN),
      );

      const mockRequest: JsonRpc = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'execute_tool', arguments: {} },
        id: '123',
      };

      const result = await service.handleMCPCoreQuery(mockRequest, {
        workspace: mockWorkspace,
        userWorkspaceId: mockUserWorkspaceId,
        apiKey: undefined,
      });

      expect(result).toEqual({
        id: '123',
        jsonrpc: '2.0',
        error: {
          code: JSON_RPC_ERROR_CODE.SERVER_ERROR,
          message: 'Role ID missing',
        },
      });
    });
  });
});
