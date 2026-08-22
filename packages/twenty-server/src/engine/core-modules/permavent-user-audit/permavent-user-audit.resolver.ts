import { UseGuards } from '@nestjs/common';
import { Args, Field, InputType, ObjectType, Query } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { PermissionFlagType } from 'twenty-shared/constants';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermaventUserAuditService } from './permavent-user-audit.service';

@InputType()
class PermaventUserAuditQueryInput {
  @Field(() => Number, { nullable: true, defaultValue: 50 }) first?: number;
  @Field({ nullable: true }) after?: string;
  @Field({ nullable: true }) userWorkspaceId?: string;
  @Field({ nullable: true }) action?: string;
  @Field({ nullable: true }) objectName?: string;
  @Field({ nullable: true }) recordId?: string;
  @Field(() => Date, { nullable: true }) from?: Date;
  @Field(() => Date, { nullable: true }) to?: Date;
}

@ObjectType()
class PermaventUserAuditEntryDTO {
  @Field() id: string;
  @Field() workspaceId: string;
  @Field({ nullable: true }) userWorkspaceId: string | null;
  @Field({ nullable: true }) workspaceMemberId: string | null;
  @Field({ nullable: true }) actorDisplayName: string | null;
  @Field() action: string;
  @Field() result: string;
  @Field({ nullable: true }) objectMetadataId: string | null;
  @Field({ nullable: true }) objectName: string | null;
  @Field({ nullable: true }) recordId: string | null;
  @Field({ nullable: true }) recordName: string | null;
  @Field(() => [String]) changedFields: string[];
  @Field(() => GraphQLJSON) newValues: Record<string, unknown>;
  @Field({ nullable: true }) denialCategory: string | null;
  @Field() createdAt: Date;
}

@ObjectType()
class PermaventUserAuditConnectionDTO {
  @Field(() => [PermaventUserAuditEntryDTO])
  entries: PermaventUserAuditEntryDTO[];
  @Field({ nullable: true }) endCursor: string | null;
  @Field() hasNextPage: boolean;
}

@MetadataResolver()
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.SECURITY),
)
export class PermaventUserAuditResolver {
  constructor(private readonly service: PermaventUserAuditService) {}
  @Query(() => PermaventUserAuditConnectionDTO)
  async permaventUserAuditEntries(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: PermaventUserAuditQueryInput,
  ): Promise<PermaventUserAuditConnectionDTO> {
    return this.service.find(workspace.id, input);
  }
}
