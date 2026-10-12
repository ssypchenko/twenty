import { UseGuards } from '@nestjs/common';
import {
  Field,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import GraphQLJSON from 'graphql-type-json';

import { PermaventUserAuditResolver } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.resolver';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@ObjectType()
class CanonicalJsonScalarTestDTO {
  @Field(() => GraphQLJSON)
  value: Record<string, unknown>;
}

@Resolver()
@UseGuards(WorkspaceAuthGuard, NoPermissionGuard)
class CanonicalJsonScalarTestResolver {
  @Query(() => CanonicalJsonScalarTestDTO)
  canonicalJsonScalarTest(): CanonicalJsonScalarTestDTO {
    return { value: {} };
  }
}

describe('PermaventUserAuditResolver GraphQL metadata', () => {
  it('builds alongside the canonical Twenty JSON scalar', async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();

    const schemaFactory = module.get(GraphQLSchemaFactory);

    await expect(
      schemaFactory.create([
        PermaventUserAuditResolver,
        CanonicalJsonScalarTestResolver,
      ]),
    ).resolves.toBeDefined();
  });
});
