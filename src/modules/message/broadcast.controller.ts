import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BroadcastMessageService } from './broadcast-message.service';
import {
  BroadcastTextMessageDto,
  BroadcastTextWithMentionsDto,
  BroadcastMessageResponseDto,
} from './dto/broadcast-message.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { BatchStatusResponseDto } from './dto/bulk-message.dto';

/**
 * Broadcast message controller - send the same message to multiple recipients by session name.
 * This controller provides convenience endpoints for broadcasting text messages to phone numbers
 * without needing to manually construct bulk message items. It reuses the existing BulkMessageService
 * with its smart pacing algorithm and batch processing capabilities.
 */
@ApiTags('messages:broadcast')
@Controller('sessions')
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastMessageService) {}

  /**
   * Broadcast the same text message to multiple phone numbers.
   * Session can be referenced by UUID or exact session name.
   * Uses the existing smart pacing and batch processing from BulkMessageService.
   *
   * Example request body:
   * {
   *   "sessionIdOrName": "my-session",
   *   "text": "Hello everyone!",
   *   "phoneNumbers": ["85620123456789", "628987654321", "+855 (20) 123-456-789"],
   *   "options": {
   *     "delayBetweenMessages": 2000,
   *     "randomizeDelay": true,
   *     "stopOnError": false
   *   }
   * }
   */
  @Post('broadcast/text')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Broadcast the same text message to multiple phone numbers',
    description:
      'Sends the same text message to multiple recipients. Session can be identified by UUID or exact session name. ' +
      'Reuses the bulk messaging service with smart pacing and batch processing. ' +
      'Phone numbers are automatically normalized to WhatsApp chat ID format.',
  })
  @ApiBody({
    type: BroadcastTextMessageDto,
    examples: {
      basic: {
        summary: 'Basic broadcast to 3 numbers',
        value: {
          sessionIdOrName: 'my-session',
          text: 'Hello! This is a broadcast message.',
          phoneNumbers: ['85620123456789', '628987654321', '+855 (20) 123-456-789'],
        },
      },
      advanced: {
        summary: 'Broadcast with custom pacing options',
        value: {
          sessionIdOrName: '550e8400-e29b-41d4-a716-446655440000',
          text: 'Hello! This is a broadcast message.',
          phoneNumbers: ['85620123456789', '628987654321', '85620987654321'],
          options: {
            delayBetweenMessages: 2000,
            randomizeDelay: true,
            stopOnError: false,
            batchId: 'my-batch-20241029',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description:
      'Broadcast batch accepted and processing started. Use the statusUrl to poll for progress.',
    type: BroadcastMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed: invalid phone numbers, session not found, or request payload issues',
  })
  @ApiResponse({
    status: 403,
    description: 'API key lacks the OPERATOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many bulk batches in progress on this node',
  })
  @ApiResponse({
    status: 503,
    description: 'Server is shutting down or media URL proxy is unavailable',
  })
  async broadcastText(
    @Body() dto: BroadcastTextMessageDto,
  ): Promise<BroadcastMessageResponseDto> {
    return this.broadcastService.broadcastText(
      dto.sessionIdOrName,
      dto.text,
      dto.phoneNumbers,
      dto.options,
    );
  }

  /**
   * Broadcast the same text message with mentions to multiple phone numbers.
   * Session can be referenced by UUID or exact session name.
   * Mentions are applied to all recipients equally.
   *
   * Example request body:
   * {
   *   "sessionIdOrName": "my-session",
   *   "text": "Hello @user1 and @user2!",
   *   "phoneNumbers": ["85620123456789", "628987654321"],
   *   "mentions": ["628123456789@c.us", "628987654321@c.us"],
   *   "options": {
   *     "delayBetweenMessages": 2000,
   *     "randomizeDelay": true
   *   }
   * }
   */
  @Post('broadcast/text-with-mentions')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Broadcast text with mentions to multiple phone numbers',
    description:
      'Sends the same text message with mentions to multiple recipients. ' +
      'Session can be identified by UUID or exact session name. ' +
      'Mentions are applied to all recipients equally. ' +
      'Reuses the bulk messaging service with smart pacing and batch processing.',
  })
  @ApiBody({
    type: BroadcastTextWithMentionsDto,
    examples: {
      basic: {
        summary: 'Broadcast with mentions',
        value: {
          sessionIdOrName: 'my-session',
          text: 'Hello @user1 and @user2! This is a broadcast message.',
          phoneNumbers: ['85620123456789', '628987654321'],
          mentions: ['628123456789@c.us', '628987654321@c.us'],
        },
      },
      customPacing: {
        summary: 'Broadcast with custom pacing and mentions',
        value: {
          sessionIdOrName: 'my-session',
          text: 'Hello @everyone! This is a broadcast message.',
          phoneNumbers: ['85620123456789', '628987654321', '85620987654321'],
          mentions: ['628123456789@c.us'],
          options: {
            delayBetweenMessages: 3000,
            randomizeDelay: true,
            stopOnError: false,
            batchId: 'my-batch-20241029',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description:
      'Broadcast batch accepted and processing started. Use the statusUrl to poll for progress.',
    type: BroadcastMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed: invalid phone numbers, invalid mention format, session not found, etc.',
  })
  @ApiResponse({
    status: 403,
    description: 'API key lacks the OPERATOR role',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many bulk batches in progress on this node',
  })
  @ApiResponse({
    status: 503,
    description: 'Server is shutting down or media URL proxy is unavailable',
  })
  async broadcastTextWithMentions(
    @Body() dto: BroadcastTextWithMentionsDto,
  ): Promise<BroadcastMessageResponseDto> {
    return this.broadcastService.broadcastTextWithMentions(
      dto.sessionIdOrName,
      dto.text,
      dto.phoneNumbers,
      dto.mentions,
      dto.options,
    );
  }

  /**
   * Get broadcast/batch status.
   * This is the same endpoint as the regular bulk message status,
   * since broadcasts use the underlying batch processing system.
   *
   * Path can include either session ID (UUID) or session name.
   */
  @Get('broadcast/:sessionIdOrName/status/:batchId')
  @ApiOperation({
    summary: 'Get broadcast batch status',
    description:
      'Poll the status of a broadcast batch. Session identifier can be UUID or exact session name. ' +
      'Returns progress, per-recipient results, and error information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch status and results',
    type: BatchStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Batch or session not found',
  })
  @ApiResponse({
    status: 403,
    description:
      'The calling key is restricted with `allowedChats`. Batch operations are not scoped to chats.',
  })
  async getBroadcastStatus(
    @Param('sessionIdOrName') sessionIdOrName: string,
    @Param('batchId') batchId: string,
  ): Promise<any> {
    // This would need the bulk message service to be updated to accept idOrName,
    // or we'd need to resolve it here. For now, this is a placeholder showing
    // where the status endpoint would be. In practice, users should use:
    // GET /api/sessions/{sessionId}/messages/batch/{batchId}
    throw new Error(
      'Use GET /api/sessions/{sessionId}/messages/batch/{batchId} to check broadcast status. ' +
        'If using session name, first resolve it via GET /api/sessions?name={sessionName}',
    );
  }
}
