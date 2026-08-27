import { Injectable } from '@nestjs/common';

import { type CodeInterpreterDriver } from 'src/engine/core-modules/code-interpreter/drivers/interfaces/code-interpreter-driver.interface';

import { CodeInterpreterDriverType } from 'src/engine/core-modules/code-interpreter/code-interpreter.interface';
import { DisabledDriver } from 'src/engine/core-modules/code-interpreter/drivers/disabled.driver';
import { E2BDriver } from 'src/engine/core-modules/code-interpreter/drivers/e2b.driver';
import { LocalDriver } from 'src/engine/core-modules/code-interpreter/drivers/local.driver';
import { PermaventInternalDriver } from 'src/engine/core-modules/code-interpreter/drivers/permavent-internal.driver';
import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';
import { DriverFactoryBase } from 'src/engine/core-modules/twenty-config/dynamic-factory.base';
import { ConfigVariablesGroup } from 'src/engine/core-modules/twenty-config/enums/config-variables-group.enum';
import { ConfigGroupHashService } from 'src/engine/core-modules/twenty-config/services/config-group-hash.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class CodeInterpreterDriverFactory extends DriverFactoryBase<CodeInterpreterDriver> {
  constructor(
    twentyConfigService: TwentyConfigService,
    configGroupHashService: ConfigGroupHashService,
  ) {
    super(twentyConfigService, configGroupHashService);
  }

  protected buildConfigKey(): string {
    const driverType = this.twentyConfigService.get('CODE_INTERPRETER_TYPE');

    if (driverType === CodeInterpreterDriverType.E_2_B) {
      return `e2b|${this.configGroupHashService.computeHash(ConfigVariablesGroup.CODE_INTERPRETER_CONFIG)}`;
    }

    if (driverType === CodeInterpreterDriverType.PERMAVENT_INTERNAL) {
      return `permavent-internal|${this.configGroupHashService.computeHash(ConfigVariablesGroup.CODE_INTERPRETER_CONFIG)}`;
    }

    return driverType;
  }

  protected createDriver(): CodeInterpreterDriver {
    const driverType = this.twentyConfigService.get('CODE_INTERPRETER_TYPE');
    const timeoutMs = this.twentyConfigService.get(
      'CODE_INTERPRETER_TIMEOUT_MS',
    );

    switch (driverType) {
      case CodeInterpreterDriverType.DISABLED:
        return new DisabledDriver(
          'Code interpreter is disabled. Configure an approved sandbox driver to enable it.',
        );

      case CodeInterpreterDriverType.LOCAL: {
        const nodeEnv = this.twentyConfigService.get('NODE_ENV');

        if (nodeEnv === NodeEnvironment.PRODUCTION) {
          return new DisabledDriver(
            'LOCAL code interpreter driver is not allowed in production. Use E2B driver instead by setting CODE_INTERPRETER_TYPE=E2B and providing E2B_API_KEY.',
          );
        }

        return new LocalDriver({
          timeoutMs,
          idleTimeoutMs: this.twentyConfigService.get(
            'CODE_INTERPRETER_IDLE_TIMEOUT_MS',
          ),
        });
      }

      case CodeInterpreterDriverType.E_2_B: {
        const apiKey = this.twentyConfigService.get('E2B_API_KEY');

        if (!apiKey) {
          throw new Error(
            'E2B_API_KEY is required when CODE_INTERPRETER_TYPE is E2B',
          );
        }

        return new E2BDriver({
          apiKey,
          timeoutMs,
          idleTimeoutMs: this.twentyConfigService.get(
            'CODE_INTERPRETER_IDLE_TIMEOUT_MS',
          ),
        });
      }

      case CodeInterpreterDriverType.PERMAVENT_INTERNAL: {
        const runnerUrl = this.twentyConfigService.get(
          'PERMAVENT_CODE_INTERPRETER_RUNNER_URL',
        );
        const authToken = this.twentyConfigService.get(
          'PERMAVENT_CODE_INTERPRETER_RUNNER_TOKEN',
        );

        if (!runnerUrl || !authToken) {
          throw new Error(
            'The internal Permavent code runner URL and authentication token are required',
          );
        }

        return new PermaventInternalDriver({
          runnerUrl,
          authToken,
          executionTimeoutMs: timeoutMs,
          requestTimeoutMs: this.twentyConfigService.get(
            'PERMAVENT_CODE_INTERPRETER_RUNNER_REQUEST_TIMEOUT_MS',
          ),
        });
      }

      default:
        throw new Error(
          `Invalid code interpreter driver type (${driverType}), check your .env file`,
        );
    }
  }
}
