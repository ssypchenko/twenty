import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';

import { PermaventUserAuditResolver } from 'src/engine/core-modules/permavent-user-audit/permavent-user-audit.resolver';

describe('PermaventUserAuditResolver GraphQL metadata', () => {
  it('builds the GraphQL schema without undefined runtime types', async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();

    const schemaFactory = module.get(GraphQLSchemaFactory);

    await expect(
      schemaFactory.create([PermaventUserAuditResolver]),
    ).resolves.toBeDefined();
  });
});
