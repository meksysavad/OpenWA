import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  MinLength,
} from 'class-validator';
import { ToStrictArray, ToStrictString } from '../../../common/utils/strict-boolean';

/**
 * Request DTO to create or update a saved broadcast alert.
 * Stores a reusable recipient list for recurring alerts/reports.
 */
export class CreateBroadcastAlertDto {
  @ApiProperty({
    description: 'Unique name for this alert (e.g., "security-alerts", "daily-reports")',
    minLength: 3,
    maxLength: 255,
    example: 'security-alerts',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: 'Description of the alert purpose',
    example: 'Send security alerts to admin team',
    maxLength: 512,
  })
  @IsOptional()
  @ToStrictString()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiProperty({
    description: 'Session UUID or name to send from',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsString()
  sessionIdOrName!: string;

  @ApiProperty({
    description: 'Array of phone numbers to store (e.g., ["+855 (20) 123-456-789", "628987654321"])',
    type: [String],
    example: ['+855 (20) 123-456-789', '628987654321', '85620123456789@c.us'],
    maxItems: 100,
  })
  @IsNotEmpty()
  @IsArray()
  @ToStrictArray()
  @ArrayMaxSize(100)
  phoneNumbers!: string[];
}

/**
 * Request DTO to update an existing broadcast alert.
 */
export class UpdateBroadcastAlertDto {
  @ApiPropertyOptional({
    description: 'Updated description',
    maxLength: 512,
  })
  @IsOptional()
  @ToStrictString()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated phone numbers array',
    type: [String],
    maxItems: 100,
  })
  @IsOptional()
  @IsArray()
  @ToStrictArray()
  @ArrayMaxSize(100)
  phoneNumbers?: string[];
}

/**
 * Response DTO for broadcast alert operations.
 */
export class BroadcastAlertResponseDto {
  @ApiProperty({ description: 'Alert UUID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ description: 'Unique alert name', example: 'security-alerts' })
  name!: string;

  @ApiPropertyOptional({ description: 'Alert description' })
  description?: string;

  @ApiProperty({ description: 'Associated session ID' })
  sessionId!: string;

  @ApiProperty({
    description: 'Number of recipients in this alert',
    example: 5,
  })
  recipientCount!: number;

  @ApiProperty({
    description: 'ISO timestamp of creation',
    example: '2026-10-29T11:12:40.370Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'ISO timestamp of last update',
    example: '2026-10-29T11:12:40.370Z',
  })
  updatedAt!: Date;
}

/**
 * Response DTO when listing alerts.
 */
export class BroadcastAlertListResponseDto {
  @ApiProperty({
    description: 'Array of alerts',
    type: [BroadcastAlertResponseDto],
  })
  alerts!: BroadcastAlertResponseDto[];

  @ApiProperty({
    description: 'Total count of alerts',
    example: 5,
  })
  total!: number;
}

/**
 * Request DTO to send a broadcast using a saved alert.
 */
export class SendBroadcastAlertDto {
  @ApiProperty({
    description: 'Text message to send',
    maxLength: 65536,
    example: 'System alert: Security issue detected',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(65536)
  text!: string;

  @ApiPropertyOptional({
    description: 'Delay between messages in ms (1000-60000)',
    default: 3000,
    minimum: 1000,
    maximum: 60000,
  })
  @IsOptional()
  delayBetweenMessages?: number;

  @ApiPropertyOptional({
    description: 'Add random 0-2s to delay',
    default: true,
  })
  @IsOptional()
  randomizeDelay?: boolean;

  @ApiPropertyOptional({
    description: 'Stop batch on first error',
    default: false,
  })
  @IsOptional()
  stopOnError?: boolean;
}

/**
 * Response DTO when sending via saved alert.
 * Returns the batch ID for progress tracking.
 */
export class SendBroadcastAlertResponseDto {
  @ApiProperty({
    description: 'Unique batch ID for tracking this broadcast',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  batchId!: string;

  @ApiProperty({
    description: 'Alert name that was used',
    example: 'security-alerts',
  })
  alertName!: string;

  @ApiProperty({
    description: 'Number of recipients this broadcast will be sent to',
    example: 5,
  })
  recipientCount!: number;

  @ApiProperty({
    description: 'HTTP status code',
    example: 202,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Message status',
    example: 'Broadcast accepted for processing',
  })
  message!: string;
}
