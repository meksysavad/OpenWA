import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { ToStrictArray, ToStrictBoolean, ToStrictString } from '../../../common/utils/strict-boolean';
import { MESSAGE_TEXT_MAX_LENGTH, MENTIONS_MAX, MENTION_WID_MAX_LENGTH } from './send-message.dto';

class BroadcastMessageOptionsDto {
  @ApiPropertyOptional({
    description: 'Delay between messages in ms (1000-60000)',
    default: 3000,
    minimum: 1000,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  delayBetweenMessages?: number;

  @ApiPropertyOptional({ description: 'Add random 0-2s to delay', default: true })
  @ToStrictBoolean()
  @IsOptional()
  @IsBoolean()
  randomizeDelay?: boolean;

  @ApiPropertyOptional({ description: 'Stop batch on first error', default: false })
  @ToStrictBoolean()
  @IsOptional()
  @IsBoolean()
  stopOnError?: boolean;

  @ApiPropertyOptional({
    description: 'Custom batch ID (auto-generated if not provided)',
    maxLength: 36,
  })
  @IsOptional()
  @ToStrictString()
  @IsString()
  @MaxLength(36)
  batchId?: string;
}

/**
 * DTO for broadcasting the same text message to multiple phone numbers.
 * Session can be referenced by UUID or exact session name.
 */
export class BroadcastTextMessageDto {
  @ApiProperty({
    description:
      'Session ID (UUID) or exact session name. Name matching is case-sensitive and exact. ' +
      'Example: "550e8400-e29b-41d4-a716-446655440000" or "my-session"',
    example: 'my-session',
  })
  @ToStrictString()
  @IsString()
  @IsNotEmpty()
  sessionIdOrName!: string;

  @ApiProperty({
    description: 'Text message to broadcast to all recipients',
    maxLength: MESSAGE_TEXT_MAX_LENGTH,
    example: 'Hello! This is a broadcast message.',
  })
  @ToStrictString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  text!: string;

  @ApiProperty({
    description:
      'Array of phone numbers or chat IDs (max 100). ' +
      'Phone numbers are automatically normalized to chat IDs in format "digits@c.us". ' +
      'Supports various formats: "85620123456789", "+855 20 123 456 789", "628123456789@c.us", etc. ' +
      'Duplicate entries are de-duplicated.',
    type: [String],
    maxItems: 100,
    example: ['85620123456789', '628987654321', '+855 (20) 123-456-789'],
  })
  @ToStrictArray()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  phoneNumbers!: string[];

  @ApiPropertyOptional({
    description: 'Batch processing options (delays, error handling, batch ID)',
    type: BroadcastMessageOptionsDto,
  })
  @IsOptional()
  options?: BroadcastMessageOptionsDto;
}

/**
 * DTO for broadcasting the same text message with mentions to multiple phone numbers.
 * Mentions are applied to all recipients equally.
 */
export class BroadcastTextWithMentionsDto {
  @ApiProperty({
    description:
      'Session ID (UUID) or exact session name. Name matching is case-sensitive and exact. ' +
      'Example: "550e8400-e29b-41d4-a716-446655440000" or "my-session"',
    example: 'my-session',
  })
  @ToStrictString()
  @IsString()
  @IsNotEmpty()
  sessionIdOrName!: string;

  @ApiProperty({
    description: 'Text message to broadcast to all recipients',
    maxLength: MESSAGE_TEXT_MAX_LENGTH,
    example: 'Hello @user1 and @user2! This is a broadcast message.',
  })
  @ToStrictString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  text!: string;

  @ApiProperty({
    description:
      'Array of phone numbers or chat IDs (max 100). ' +
      'Phone numbers are automatically normalized to chat IDs in format "digits@c.us". ' +
      'Supports various formats: "85620123456789", "+855 20 123 456 789", "628123456789@c.us", etc. ' +
      'Duplicate entries are de-duplicated.',
    type: [String],
    maxItems: 100,
    example: ['85620123456789', '628987654321', '+855 (20) 123-456-789'],
  })
  @ToStrictArray()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  phoneNumbers!: string[];

  @ApiPropertyOptional({
    description:
      'WID strings to mention (tag) in the message. Same mentions are applied to all recipients. ' +
      'Max 25 mentions per message. Format: "628123456789@c.us"',
    type: [String],
    maxItems: MENTIONS_MAX,
    example: ['628123456789@c.us', '628987654321@c.us'],
  })
  @IsOptional()
  @ToStrictArray()
  @IsArray()
  @ArrayMaxSize(MENTIONS_MAX)
  @IsString({ each: true })
  @MaxLength(MENTION_WID_MAX_LENGTH, { each: true })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Batch processing options (delays, error handling, batch ID)',
    type: BroadcastMessageOptionsDto,
  })
  @IsOptional()
  options?: BroadcastMessageOptionsDto;
}

/**
 * Response DTO for broadcast send (same as bulk message response).
 * The batch ID can be used to poll the status.
 */
export class BroadcastMessageResponseDto {
  @ApiProperty({
    description: 'Batch ID for tracking this broadcast',
    example: 'batch_abc123def456',
  })
  batchId!: string;

  @ApiProperty({
    description: 'Current batch status (always "PROCESSING" on initial response)',
    example: 'PROCESSING',
  })
  status!: string;

  @ApiProperty({
    description: 'Total number of recipients',
    example: 50,
  })
  totalMessages!: number;

  @ApiPropertyOptional({
    description: 'Estimated completion time (ISO 8601)',
    example: '2026-10-29T11:05:00.000Z',
  })
  estimatedCompletionTime?: string;

  @ApiProperty({
    description:
      'URL to poll for batch status. Use GET /api/sessions/{sessionId}/messages/batch/{batchId}',
    example:
      '/api/sessions/550e8400-e29b-41d4-a716-446655440000/messages/batch/batch_abc123def456',
  })
  statusUrl!: string;
}
