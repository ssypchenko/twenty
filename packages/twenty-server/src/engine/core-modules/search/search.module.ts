import { Module } from '@nestjs/common';

import { FileModule } from 'src/engine/core-modules/file/file.module';
import { PermaventSecurityModule } from 'src/engine/core-modules/permavent-security/permavent-security.module';
import { SearchResolver } from 'src/engine/core-modules/search/search.resolver';
import { SearchService } from 'src/engine/core-modules/search/services/search.service';
import { WorkspaceManyOrAllFlatEntityMapsCacheModule } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module';

@Module({
  imports: [
    FileModule,
    PermaventSecurityModule,
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
  ],
  providers: [SearchResolver, SearchService],
})
export class SearchModule {}
