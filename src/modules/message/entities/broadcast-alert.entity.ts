import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * BroadcastAlert entity stores pre-configured recipient lists for alert broadcasting.
 * Normalizes phone numbers to chat IDs once and reuses them for efficient alert delivery.
 * Designed for technical alerts/reports where recipient lists rarely change.
 */
@Entity('broadcast_alerts')
@Unique(['name'])
@Index(['sessionId'])
export class BroadcastAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique name for this alert list (e.g., 'security-alerts', 'daily-reports', 'error-notifications').
   * Used to reference the alert in API calls.
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Optional description of the alert's purpose.
   * Helps identify what the alert is used for.
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Session ID associated with this alert.
   * The WhatsApp session that will send messages.
   */
  @Column({ type: 'uuid' })
  sessionId!: string;

  /**
   * Array of normalized chat IDs (e.g., '85620123456789@c.us', '628987654321@c.us').
   * Stored as JSON array for easy iteration when sending broadcasts.
   * Pre-normalized on creation/update to avoid runtime processing.
   */
  @Column({ type: 'json', default: () => 'json_array()' })
  chatIds!: string[];

  /**
   * Timestamp when the alert was created.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Timestamp when the alert was last updated.
   */
  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Soft delete flag for audit trail.
   * true = alert is disabled but kept for history, false = active alert.
   */
  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;
}
