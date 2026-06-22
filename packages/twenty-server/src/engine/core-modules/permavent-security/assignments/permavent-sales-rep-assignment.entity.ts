import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'permaventSalesRepAssignment', schema: 'core' })
@Index(
  'IDX_PERMAVENT_SALES_REP_ASSIGNMENT_UNIQUE',
  ['workspaceId', 'userEmail', 'erpSalesRepCode'],
  { unique: true },
)
@Index('IDX_PERMAVENT_SALES_REP_ASSIGNMENT_LOOKUP', [
  'workspaceId',
  'userEmail',
  'isActive',
])
@Index('IDX_PERMAVENT_SALES_REP_ASSIGNMENT_REVERSE_LOOKUP', [
  'workspaceId',
  'erpSalesRepCode',
  'isActive',
])
@Check(
  'CHK_PERMAVENT_SALES_REP_ASSIGNMENT_CODE',
  `"erpSalesRepCode" ~ '^[A-Z]{2,3}$'`,
)
@Check(
  'CHK_PERMAVENT_SALES_REP_ASSIGNMENT_EMAIL',
  `"userEmail" = LOWER(BTRIM("userEmail")) AND LENGTH("userEmail") > 0`,
)
@Check(
  'CHK_PERMAVENT_SALES_REP_ASSIGNMENT_VALIDITY',
  `"validFrom" IS NULL OR "validTo" IS NULL OR "validTo" > "validFrom"`,
)
export class PermaventSalesRepAssignmentEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userWorkspaceId: string | null;

  @ManyToOne(() => UserWorkspaceEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userWorkspaceId' })
  userWorkspace: Relation<UserWorkspaceEntity> | null;

  @Column({ type: 'uuid', nullable: true })
  workspaceMemberId: string | null;

  @Column({ type: 'varchar', length: 320 })
  userEmail: string;

  @Column({ type: 'varchar', length: 3 })
  erpSalesRepCode: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
