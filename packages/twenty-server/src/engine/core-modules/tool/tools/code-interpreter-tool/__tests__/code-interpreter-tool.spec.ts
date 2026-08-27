import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { type CodeInterpreterService } from 'src/engine/core-modules/code-interpreter/code-interpreter.service';
import { CodeInterpreterDriverType } from 'src/engine/core-modules/code-interpreter/code-interpreter.interface';
import { type FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { type FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { type FileService } from 'src/engine/core-modules/file/services/file.service';
import { type JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { type SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { CodeInterpreterTool } from 'src/engine/core-modules/tool/tools/code-interpreter-tool/code-interpreter-tool';
import { TWENTY_MCP_HELPER } from 'src/engine/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.const';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const createTool = (driverType: CodeInterpreterDriverType) => {
  const codeInterpreterService = {
    execute: jest.fn().mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      files: [],
    }),
  } as unknown as jest.Mocked<CodeInterpreterService>;
  const jwtWrapperService = {
    signAsyncOrThrow: jest.fn().mockResolvedValue('session-token'),
  } as unknown as jest.Mocked<JwtWrapperService>;
  const twentyConfigService = {
    get: jest.fn((key: string) =>
      key === 'SERVER_URL' ? 'https://crm.example.test' : driverType,
    ),
  } as unknown as jest.Mocked<TwentyConfigService>;

  const tool = new CodeInterpreterTool(
    codeInterpreterService,
    {} as FileStorageService,
    {} as FileService,
    {} as FileUrlService,
    {} as ApplicationService,
    {} as SecureHttpClientService,
    twentyConfigService,
    jwtWrapperService,
  );

  return { codeInterpreterService, jwtWrapperService, tool };
};

describe('CodeInterpreterTool MCP access', () => {
  it('signs an MCP-only token for the internal sandbox driver', async () => {
    const { codeInterpreterService, jwtWrapperService, tool } = createTool(
      CodeInterpreterDriverType.PERMAVENT_INTERNAL,
    );

    await tool.execute(
      { code: 'print(1)' },
      {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        userWorkspaceId: 'user-workspace-1',
      },
    );

    expect(jwtWrapperService.signAsyncOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: JwtTokenTypeEnum.MCP_ACCESS,
      }),
      { expiresIn: '5m' },
    );
    expect(codeInterpreterService.execute).toHaveBeenCalledWith(
      expect.stringContaining(TWENTY_MCP_HELPER),
      [],
      expect.objectContaining({
        env: {
          TWENTY_SERVER_URL: 'https://crm.example.test',
          TWENTY_API_TOKEN: 'session-token',
        },
      }),
      expect.any(Object),
    );
  });

  it('keeps an ordinary access token for other sandbox drivers', async () => {
    const { jwtWrapperService, tool } = createTool(
      CodeInterpreterDriverType.LOCAL,
    );

    await tool.execute({ code: 'print(1)' }, { workspaceId: 'workspace-1' });

    const [payload] = jwtWrapperService.signAsyncOrThrow.mock.calls[0];

    expect(payload).toEqual(
      expect.objectContaining({ type: JwtTokenTypeEnum.ACCESS }),
    );
  });

  it('keeps mutation helpers out of the injected Python API', () => {
    expect(TWENTY_MCP_HELPER).not.toContain('bulk_upsert');
    expect(TWENTY_MCP_HELPER).toContain('_READ_ONLY_CATALOG_PREFIXES');
    expect(TWENTY_MCP_HELPER).toContain('raise PermissionError');
  });
});
