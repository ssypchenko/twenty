import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'permaventUserAuditEntry', schema: 'core' })
@Index('IDX_PERMAVENT_USER_AUDIT_WORKSPACE_CREATED', [
  'workspaceId',
  'createdAt',
])
@Index('IDX_PERMAVENT_USER_AUDIT_WORKSPACE_RECORD', ['workspaceId', 'recordId'])
@Index('UQ_PERMAVENT_USER_AUDIT_SOURCE_EVENT', ['sourceEventId'], {
  unique: true,
})
export class PermaventUserAuditEntryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) workspaceId: string;
  @Column({ type: 'uuid', nullable: true }) userWorkspaceId: string | null;
  @Column({ type: 'uuid', nullable: true }) workspaceMemberId: string | null;
  @Column({ type: 'varchar', nullable: true }) actorDisplayName: string | null;
  @Column({ type: 'varchar' }) action: string;
  @Column({ type: 'varchar' }) result: 'SUCCESS' | 'DENIED';
  @Column({ type: 'uuid', nullable: true }) objectMetadataId: string | null;
  @Column({ type: 'varchar', nullable: true }) objectName: string | null;
  @Column({ type: 'uuid', nullable: true }) recordId: string | null;
  @Column({ type: 'varchar', nullable: true }) recordName: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) changedFields: string[];
  @Column({ type: 'jsonb', default: () => "'{}'" }) newValues: Record<
    string,
    unknown
  >;
  @Column({ type: 'varchar', nullable: true }) denialCategory: string | null;
  @Column({ type: 'varchar', nullable: true }) sourceEventId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
