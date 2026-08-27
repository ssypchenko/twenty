import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermaventDelegatedContextService } from 'src/engine/core-modules/permavent-delegated-api/services/permavent-delegated-context.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { CoreEntityCacheModule } from 'src/engine/core-entity-cache/core-entity-cache.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    CoreEntityCacheModule,
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
    WorkspaceCacheModule,
  ],
  providers: [PermaventDelegatedContextService],
  exports: [PermaventDelegatedContextService],
})
export class PermaventDelegatedApiModule {}
