import { type ExecutionContext } from '@nestjs/common';

import { type Request } from 'express';

import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';

describe('JwtAuthGuard', () => {
  const request = { headers: {} } as Request;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const createGuard = () => {
    const accessTokenService = {
      validateTokenByRequest: jest.fn().mockResolvedValue({
        userWorkspaceId: 'user-workspace-id',
        workspace: { id: 'workspace-id' },
      }),
    } as unknown as jest.Mocked<AccessTokenService>;
    const workspaceCacheStorageService = {
      getMetadataVersion: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<WorkspaceCacheStorageService>;

    return {
      accessTokenService,
      guard: new JwtAuthGuard(accessTokenService, workspaceCacheStorageService),
    };
  };

  it('should use the default-deny token validation path for normal endpoints', async () => {
    const { accessTokenService, guard } = createGuard();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(accessTokenService.validateTokenByRequest).toHaveBeenCalledWith(
      request,
      undefined,
    );
  });

  it('should opt in to MCP access tokens only for the MCP guard path', async () => {
    const { accessTokenService, guard } = createGuard();

    await expect(guard.canActivateMcp(context)).resolves.toBe(true);

    expect(accessTokenService.validateTokenByRequest).toHaveBeenCalledWith(
      request,
      { allowMcpAccessToken: true },
    );
  });
});
