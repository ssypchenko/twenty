import { MODULE_METADATA } from '@nestjs/common/constants';

import { WorkspaceDataSourceService } from 'src/engine/twenty-orm/datasource/workspace-data-source.service';
import { TwentyOrmModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';

describe('TwentyOrmModule providers for Permavent consumers', () => {
  it('provides and exports the existing WorkspaceDataSourceService', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      TwentyOrmModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      TwentyOrmModule,
    ) as unknown[];

    expect(providers).toContain(WorkspaceOrmManager);
    expect(providers).toContain(WorkspaceDataSourceService);
    expect(exports).toContain(WorkspaceOrmManager);
    expect(exports).toContain(WorkspaceDataSourceService);
  });
});
