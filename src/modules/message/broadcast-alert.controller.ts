import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { BroadcastAlertService } from './broadcast-alert.service';
import {
  CreateBroadcastAlertDto,
  UpdateBroadcastAlertDto,
  BroadcastAlertResponseDto,
  BroadcastAlertListResponseDto,
  SendBroadcastAlertDto,
  SendBroadcastAlertResponseDto,
} from './dto/broadcast-alert.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { API_KEY_SECURITY_SCHEME } from '../../config/swagger.config';

/**
 * REST API for managing broadcast alerts.
 * Broadcast alerts are pre-configured recipient lists for sending recurring alerts/reports.
 * Phone numbers are normalized to chat IDs once on creation for efficient reuse.
 *
 * Examples:
 * - Security alerts sent to admin team
 * - Daily reports sent to monitoring group
 * - Error notifications sent to DevOps team
 */
@ApiTags('Broadcast Alerts')
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@Controller('sessions/alerts')
export class BroadcastAlertController {
  constructor(private readonly broadcastAlertService: BroadcastAlertService) {}

  /**
   * Create a new broadcast alert.
   * Normalizes and stores phone numbers as chat IDs for efficient reuse.
   *
   * Example request:
   * ```
   * POST /sessions/alerts
   * {
   *   "name": "security-alerts",
   *   "description": "Send security incidents to admin team",
   *   "sessionIdOrName": "my-session",
   *   "phoneNumbers": ["+855 (20) 123-456-789", "628987654321"]
   * }
   * ```
   */
  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new broadcast alert',
    description:
      'Create a named recipient list for recurring broadcasts. Phone numbers are normalized and stored as chat IDs.',
  })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully',
    type: BroadcastAlertResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or phone number format' })
  @ApiResponse({ status: 409, description: 'Alert name already exists' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async createAlert(
    @Body() createDto: CreateBroadcastAlertDto,
  ): Promise<BroadcastAlertResponseDto> {
    return this.broadcastAlertService.createAlert(createDto);
  }

  /**
   * List all broadcast alerts.
   *
   * Example response:
   * ```
   * {
   *   "alerts": [
   *     {
   *       "id": "550e8400-e29b-41d4-a716-446655440000",
   *       "name": "security-alerts",
   *       "description": "Send security incidents to admin team",
   *       "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
   *       "recipientCount": 5,
   *       "createdAt": "2026-10-29T11:12:40.370Z",
   *       "updatedAt": "2026-10-29T11:12:40.370Z"
   *     }
   *   ],
   *   "total": 1
   * }
   * ```
   */
  @Get()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'List all broadcast alerts',
    description: 'Retrieve all active alerts across all sessions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of alerts',
    type: BroadcastAlertListResponseDto,
  })
  async listAllAlerts(): Promise<BroadcastAlertListResponseDto> {
    return this.broadcastAlertService.listAllAlerts();
  }

  /**
   * Get a specific alert by name.
   *
   * Example:
   * GET /sessions/alerts/security-alerts
   */
  @Get(':name')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Get alert by name',
    description: 'Retrieve alert details and recipient count',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert details',
    type: BroadcastAlertResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlert(@Param('name') name: string): Promise<BroadcastAlertResponseDto> {
    return this.broadcastAlertService.getAlertByName(name);
  }

  /**
   * Update an existing alert.
   * Can update description and/or phone numbers.
   *
   * Example request:
   * ```
   * PUT /sessions/alerts/security-alerts
   * {
   *   "description": "Updated description",
   *   "phoneNumbers": ["+855 (20) 123-456-789", "628987654321", "85620555555555"]
   * }
   * ```
   */
  @Put(':name')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Update a broadcast alert',
    description: 'Update alert description and/or phone numbers. New numbers are normalized.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert updated successfully',
    type: BroadcastAlertResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid phone number format' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async updateAlert(
    @Param('name') name: string,
    @Body() updateDto: UpdateBroadcastAlertDto,
  ): Promise<BroadcastAlertResponseDto> {
    return this.broadcastAlertService.updateAlert(name, updateDto);
  }

  /**
   * Delete a broadcast alert.
   * Performs soft delete (marked as deleted but kept for audit trail).
   *
   * Example:
   * DELETE /sessions/alerts/security-alerts
   */
  @Delete(':name')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a broadcast alert',
    description: 'Soft delete (marks as deleted but keeps record for audit trail)',
  })
  @ApiResponse({ status: 204, description: 'Alert deleted successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async deleteAlert(@Param('name') name: string): Promise<void> {
    return this.broadcastAlertService.deleteAlert(name);
  }

  /**
   * Send a broadcast using a saved alert.
   * Uses pre-normalized chat IDs from the alert to skip normalization overhead.
   *
   * Example request:
   * ```
   * POST /sessions/alerts/security-alerts/send
   * {
   *   "text": "Critical security incident detected!",
   *   "delayBetweenMessages": 2000,
   *   "randomizeDelay": true,
   *   "stopOnError": false
   * }
   * ```
   *
   * Example response:
   * ```
   * {
   *   "batchId": "550e8400-e29b-41d4-a716-446655440000",
   *   "alertName": "security-alerts",
   *   "recipientCount": 5,
   *   "statusCode": 202,
   *   "message": "Broadcast accepted for processing"
   * }
   * ```
   */
  @Post(':name/send')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a broadcast via a saved alert',
    description:
      'Send the same message to all recipients in a pre-configured alert. Returns batch ID for progress tracking.',
  })
  @ApiResponse({
    status: 202,
    description: 'Broadcast accepted for processing',
    type: SendBroadcastAlertResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid text or alert has no recipients' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async sendBroadcastAlert(
    @Param('name') name: string,
    @Body() sendDto: SendBroadcastAlertDto,
  ): Promise<SendBroadcastAlertResponseDto> {
    return this.broadcastAlertService.sendBroadcastAlert(name, sendDto);
  }
}
