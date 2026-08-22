import { UseGuards, UsePipes } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Int,
  ObjectType,
  Query,
} from '@nestjs/graphql';
import {
  IsDate,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { PermissionFlagType } from 'twenty-shared/constants';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermaventUserAuditService } from './permavent-user-audit.service';

@InputType()
class PermaventUserAuditQueryInput {
  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  first?: number;

  @Field(() => String, { nullable: true })
  @IsDateString()
  @IsOptional()
  after?: string;

  @Field(() => String, { nullable: true })
  @IsUUID()
  @IsOptional()
  userWorkspaceId?: string;

  @Field(() => String, { nullable: true })
  @IsIn([
    'CREATED',
    'UPDATED',
    'DELETED',
    'RESTORED',
    'DESTROYED',
    'UPSERTED',
    'RLS_DENIED',
  ])
  @IsOptional()
  action?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  objectName?: string;

  @Field(() => String, { nullable: true })
  @IsUUID()
  @IsOptional()
  objectMetadataId?: string;

  @Field(() => String, { nullable: true })
  @IsUUID()
  @IsOptional()
  recordId?: string;

  @Field(() => Date, { nullable: true })
  @IsDate()
  @IsOptional()
  from?: Date;

  @Field(() => Date, { nullable: true })
  @IsDate()
  @IsOptional()
  to?: Date;
}

@ObjectType()
class PermaventUserAuditEntryDTO {
  @Field() id: string;
  @Field() workspaceId: string;
  @Field(() => String, { nullable: true }) userWorkspaceId: string | null;
  @Field(() => String, { nullable: true }) workspaceMemberId: string | null;
  @Field(() => String, { nullable: true }) actorDisplayName: string | null;
  @Field() action: string;
  @Field() result: string;
  @Field(() => String, { nullable: true }) objectMetadataId: string | null;
  @Field(() => String, { nullable: true }) objectName: string | null;
  @Field(() => String, { nullable: true }) recordId: string | null;
  @Field(() => String, { nullable: true }) recordName: string | null;
  @Field(() => [String]) changedFields: string[];
  @Field(() => GraphQLJSON) newValues: Record<string, unknown>;
  @Field(() => String, { nullable: true }) denialCategory: string | null;
  @Field(() => Date) createdAt: Date;
}

@ObjectType()
class PermaventUserAuditConnectionDTO {
  @Field(() => [PermaventUserAuditEntryDTO])
  entries: PermaventUserAuditEntryDTO[];
  @Field(() => String, { nullable: true }) endCursor: string | null;
  @Field() hasNextPage: boolean;
}

@MetadataResolver()
@UsePipes(ResolverValidationPipe)
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
