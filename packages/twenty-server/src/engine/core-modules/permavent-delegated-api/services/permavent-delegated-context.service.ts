import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type IncomingHttpHeaders } from 'http';
import { emailSchema } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type RawAuthContext } from 'src/engine/core-modules/auth/types/raw-auth-context.type';
import {
  PERMAVENT_CORRELATION_ID_HEADER,
  PERMAVENT_DELEGATED_ACTOR_EMAIL_HEADER,
} from 'src/engine/core-modules/permavent-delegated-api/constants/permavent-delegated-context-header.constant';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { CoreEntityCacheService } from 'src/engine/core-entity-cache/services/core-entity-cache.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

@Injectable()
export class PermaventDelegatedContextService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly coreEntityCacheService: CoreEntityCacheService,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  async resolveForRequest({
    authContext,
    headers,
  }: {
    authContext: RawAuthContext;
    headers: IncomingHttpHeaders;
  }): Promise<RawAuthContext> {
    const actorEmailHeader = this.getSingleHeader(
      headers,
      PERMAVENT_DELEGATED_ACTOR_EMAIL_HEADER,
    );

    if (actorEmailHeader === undefined) {
      this.assertTrustedApiKeyHasActorHeader(authContext);

      return authContext;
    }

    if (!authContext.apiKey || !authContext.workspace) {
      throw this.forbidden('Delegated actor header requires an API key');
    }

    if (
      !this.twentyConfigService.get('PERMAVENT_DELEGATED_API_CONTEXT_ENABLED')
    ) {
      throw this.forbidden('Delegated API context is disabled');
    }

    if (!this.getTrustedApiKeyIds().has(authContext.apiKey.id)) {
      throw this.forbidden('API key is not trusted for delegated context');
    }

    const actorEmail = actorEmailHeader.trim().toLowerCase();

    if (!emailSchema.safeParse(actorEmail).success) {
      throw new AuthException(
        'Invalid delegated actor email header',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    return {
      ...authContext,
      delegatedActor: await this.resolveActor({
        actorEmail,
        workspaceId: authContext.workspace.id,
        correlationId: this.resolveCorrelationId(headers),
      }),
    };
  }

  private assertTrustedApiKeyHasActorHeader(authContext: RawAuthContext): void {
    if (
      !this.twentyConfigService.get(
        'PERMAVENT_DELEGATED_API_CONTEXT_ENABLED',
      ) ||
      !authContext.apiKey ||
      !this.getTrustedApiKeyIds().has(authContext.apiKey.id)
    ) {
      return;
    }

    throw this.forbidden('Trusted delegated API key is missing actor header');
  }

  private async resolveActor({
    actorEmail,
    workspaceId,
    correlationId,
  }: {
    actorEmail: string;
    workspaceId: string;
    correlationId: string;
  }) {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: {
        workspaceId,
        user: { email: actorEmail, disabled: false },
      },
      relations: { user: true },
    });

    if (!userWorkspace?.user || userWorkspace.user.disabled) {
      throw this.forbidden('Delegated actor is unavailable');
    }

    const user = await this.coreEntityCacheService.get(
      'user',
      userWorkspace.userId,
    );

    if (!user || user.disabled) {
      throw this.forbidden('Delegated actor is unavailable');
    }

    const { flatRoleMaps, flatWorkspaceMemberMaps, userWorkspaceRoleMap } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatRoleMaps',
        'flatWorkspaceMemberMaps',
        'userWorkspaceRoleMap',
      ]);
    const workspaceMemberId = flatWorkspaceMemberMaps.idByUserId[user.id];
    const workspaceMember = workspaceMemberId
      ? flatWorkspaceMemberMaps.byId[workspaceMemberId]
      : undefined;
    const roleId = userWorkspaceRoleMap[userWorkspace.id];
    const roleUniversalIdentifier = roleId
      ? flatRoleMaps.universalIdentifierById[roleId]
      : undefined;

    if (
      !workspaceMemberId ||
      !workspaceMember ||
      !roleId ||
      !roleUniversalIdentifier
    ) {
      throw this.forbidden('Delegated actor is unavailable');
    }

    return {
      user,
      userWorkspaceId: userWorkspace.id,
      workspaceMemberId,
      workspaceMember,
      roleId,
      roleUniversalIdentifier,
      correlationId,
    };
  }

  private resolveCorrelationId(headers: IncomingHttpHeaders): string {
    const correlationId = this.getSingleHeader(
      headers,
      PERMAVENT_CORRELATION_ID_HEADER,
    );

    if (correlationId === undefined) {
      return randomUUID();
    }

    if (!this.isUuid(correlationId)) {
      throw new AuthException(
        'Invalid correlation ID header',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    return correlationId;
  }

  private getTrustedApiKeyIds(): Set<string> {
    const rawApiKeyIds = this.twentyConfigService.get(
      'PERMAVENT_DELEGATED_API_KEY_IDS',
    );
    const apiKeyIds = rawApiKeyIds
      .split(',')
      .map((apiKeyId) => apiKeyId.trim())
      .filter((apiKeyId) => apiKeyId.length > 0);

    if (apiKeyIds.some((apiKeyId) => !this.isUuid(apiKeyId))) {
      return new Set();
    }

    return new Set(apiKeyIds);
  }

  private getSingleHeader(
    headers: IncomingHttpHeaders,
    headerName: string,
  ): string | undefined {
    const value = headers[headerName];

    if (Array.isArray(value)) {
      throw new AuthException(
        `Multiple '${headerName}' headers are not supported`,
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    return value;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private forbidden(message: string): AuthException {
    return new AuthException(message, AuthExceptionCode.FORBIDDEN_EXCEPTION);
  }
}
