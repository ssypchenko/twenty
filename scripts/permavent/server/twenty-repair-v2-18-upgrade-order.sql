\set ON_ERROR_STOP on

BEGIN;

DO $repair$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM core."upgradeMigration"
    WHERE name = '2.15.0_ExpandPermaventSalesRepCodeFastInstanceCommand_1782209253761'
      AND status = 'completed'
      AND "workspaceId" IS NULL
  ) THEN
    RAISE EXCEPTION 'The legacy Permavent v2.15 upgrade marker is missing.';
  END IF;
END
$repair$;

DO $repair$
BEGIN
  IF to_regclass('core."billingCustomer"') IS NOT NULL THEN
    ALTER TABLE core."billingCustomer"
      ADD COLUMN IF NOT EXISTS "hasPaymentMethod" boolean;
  END IF;
END
$repair$;

ALTER TABLE core."view"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."viewField"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."indexMetadata"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."commandMenuItem"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."pageLayout"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."pageLayoutTab"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."pageLayoutWidget"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;
ALTER TABLE core."fieldMetadata"
  ADD COLUMN IF NOT EXISTS "isSystemSideEffect" boolean NOT NULL DEFAULT false;

ALTER TYPE core."messageFolder_pendingsyncaction_enum"
  ADD VALUE IF NOT EXISTS 'FOLDER_IMPORT' BEFORE 'NONE';

ALTER TABLE core."view"
  ADD COLUMN IF NOT EXISTS "kanbanColumnWidth" integer;

WITH command(name, created_at) AS (
  VALUES
    (
      '2.15.0_AddHasPaymentMethodToBillingCustomerFastInstanceCommand_1781280240009',
      transaction_timestamp() + interval '1 microsecond'
    ),
    (
      '2.15.0_AddIsSystemSideEffectFastInstanceCommand_1781600000000',
      transaction_timestamp() + interval '2 microseconds'
    ),
    (
      '2.15.0_AddFolderImportToMessageFolderPendingSyncActionFastInstanceCommand_1781714499016',
      transaction_timestamp() + interval '3 microseconds'
    ),
    (
      '2.15.0_AddViewKanbanColumnWidthFastInstanceCommand_1781900000000',
      transaction_timestamp() + interval '4 microseconds'
    )
),
aligned_workspace AS (
  SELECT DISTINCT "workspaceId"
  FROM core."upgradeMigration"
  WHERE name = '2.15.0_ExpandPermaventSalesRepCodeFastInstanceCommand_1782209253761'
    AND status = 'completed'
)
INSERT INTO core."upgradeMigration" (
  id,
  name,
  status,
  attempt,
  "executedByVersion",
  "errorMessage",
  "isInitial",
  "workspaceId",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  command.name,
  'completed',
  1,
  'v2.18.0',
  NULL,
  false,
  aligned_workspace."workspaceId",
  command.created_at
FROM command
CROSS JOIN aligned_workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM core."upgradeMigration" AS existing
  WHERE existing.name = command.name
    AND existing."workspaceId" IS NOT DISTINCT FROM aligned_workspace."workspaceId"
);

DO $repair$
DECLARE
  missing_command_count integer;
  missing_column_count integer;
  missing_workspace_marker_count integer;
BEGIN
  SELECT count(*)
  INTO missing_command_count
  FROM (
    VALUES
      ('2.15.0_AddHasPaymentMethodToBillingCustomerFastInstanceCommand_1781280240009'),
      ('2.15.0_AddIsSystemSideEffectFastInstanceCommand_1781600000000'),
      ('2.15.0_AddFolderImportToMessageFolderPendingSyncActionFastInstanceCommand_1781714499016'),
      ('2.15.0_AddViewKanbanColumnWidthFastInstanceCommand_1781900000000')
  ) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM core."upgradeMigration" AS migration
    WHERE migration.name = required.name
      AND migration.status = 'completed'
      AND migration."workspaceId" IS NULL
  );

  IF missing_command_count <> 0 THEN
    RAISE EXCEPTION '% required upgrade command marker(s) are missing.', missing_command_count;
  END IF;

  SELECT count(*)
  INTO missing_workspace_marker_count
  FROM (
    SELECT required.name, aligned."workspaceId"
    FROM (
      VALUES
        ('2.15.0_AddHasPaymentMethodToBillingCustomerFastInstanceCommand_1781280240009'),
        ('2.15.0_AddIsSystemSideEffectFastInstanceCommand_1781600000000'),
        ('2.15.0_AddFolderImportToMessageFolderPendingSyncActionFastInstanceCommand_1781714499016'),
        ('2.15.0_AddViewKanbanColumnWidthFastInstanceCommand_1781900000000')
    ) AS required(name)
    CROSS JOIN (
      SELECT DISTINCT "workspaceId"
      FROM core."upgradeMigration"
      WHERE name = '2.15.0_ExpandPermaventSalesRepCodeFastInstanceCommand_1782209253761'
        AND status = 'completed'
    ) AS aligned
    WHERE NOT EXISTS (
      SELECT 1
      FROM core."upgradeMigration" AS migration
      WHERE migration.name = required.name
        AND migration.status = 'completed'
        AND migration."workspaceId" IS NOT DISTINCT FROM aligned."workspaceId"
    )
  ) AS missing;

  IF missing_workspace_marker_count <> 0 THEN
    RAISE EXCEPTION '% required workspace upgrade marker(s) are missing.', missing_workspace_marker_count;
  END IF;

  SELECT count(*)
  INTO missing_column_count
  FROM (
    VALUES
      ('view'),
      ('viewField'),
      ('indexMetadata'),
      ('commandMenuItem'),
      ('pageLayout'),
      ('pageLayoutTab'),
      ('pageLayoutWidget'),
      ('fieldMetadata')
  ) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'core'
      AND columns.table_name = required.table_name
      AND columns.column_name = 'isSystemSideEffect'
  );

  IF missing_column_count <> 0 THEN
    RAISE EXCEPTION '% required isSystemSideEffect column(s) are missing.', missing_column_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'core'
      AND table_name = 'view'
      AND column_name = 'kanbanColumnWidth'
  ) THEN
    RAISE EXCEPTION 'The required view.kanbanColumnWidth column is missing.';
  END IF;

  IF to_regclass('core."billingCustomer"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'core'
      AND table_name = 'billingCustomer'
      AND column_name = 'hasPaymentMethod'
  ) THEN
    RAISE EXCEPTION 'The required billingCustomer.hasPaymentMethod column is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum AS enum_value
    JOIN pg_type AS enum_type ON enum_type.oid = enum_value.enumtypid
    JOIN pg_namespace AS enum_namespace ON enum_namespace.oid = enum_type.typnamespace
    WHERE enum_namespace.nspname = 'core'
      AND enum_type.typname = 'messageFolder_pendingsyncaction_enum'
      AND enum_value.enumlabel = 'FOLDER_IMPORT'
  ) THEN
    RAISE EXCEPTION 'The required FOLDER_IMPORT enum value is missing.';
  END IF;
END
$repair$;

COMMIT;

SELECT 'Permavent v2.18 upgrade-order repair completed.' AS result;
