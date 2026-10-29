import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BroadcastAlert } from './entities/broadcast-alert.entity';
import { BroadcastMessageService } from './broadcast-message.service';
import {
  CreateBroadcastAlertDto,
  UpdateBroadcastAlertDto,
  BroadcastAlertResponseDto,
  SendBroadcastAlertDto,
  SendBroadcastAlertResponseDto,
} from './dto/broadcast-alert.dto';
import { Logger } from '@nestjs/common';

/**
 * Service for managing saved broadcast alerts.
 * Handles CRUD operations on pre-configured recipient lists for recurring broadcasts.
 * Normalizes phone numbers to chat IDs once on creation/update for efficient reuse.
 */
@Injectable()
export class BroadcastAlertService {
  private readonly logger = new Logger(BroadcastAlertService.name);

  constructor(
    @InjectRepository(BroadcastAlert, 'data')
    private readonly alertRepository: Repository<BroadcastAlert>,
    private readonly broadcastMessageService: BroadcastMessageService,
  ) {}

  /**
   * Create a new broadcast alert with normalized chat IDs.
   * Validates session exists and normalizes phone numbers on creation.
   *
   * @param createDto Alert configuration with phone numbers
   * @returns Created alert response with recipient count
   * @throws ConflictException if alert name already exists
   * @throws NotFoundException if session not found
   */
  async createAlert(createDto: CreateBroadcastAlertDto): Promise<BroadcastAlertResponseDto> {
    // Check if alert name already exists
    const existing = await this.alertRepository.findOne({
      where: { name: createDto.name, isDeleted: false },
    });

    if (existing) {
      throw new ConflictException(
        `Broadcast alert "${createDto.name}" already exists. Use a different name or update the existing one.`,
      );
    }

    // Validate session exists by resolving it
    let sessionId: string;
    try {
      sessionId = await this.broadcastMessageService.resolveSessionId(
        createDto.sessionIdOrName,
      );
    } catch (error) {
      throw new NotFoundException(
        `Session "${createDto.sessionIdOrName}" not found: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Normalize phone numbers to chat IDs
    let chatIds: string[];
    try {
      chatIds = this.normalizePhoneNumbersToSet(createDto.phoneNumbers);
      if (chatIds.length === 0) {
        throw new BadRequestException('No valid phone numbers provided after normalization');
      }
    } catch (error) {
      throw new BadRequestException(
        `Phone number normalization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Create and save alert
    const alert = this.alertRepository.create({
      name: createDto.name,
      description: createDto.description,
      sessionId,
      chatIds,
      isDeleted: false,
    });

    const saved = await this.alertRepository.save(alert);
    this.logger.log(
      `Created broadcast alert "${saved.name}" with ${saved.chatIds.length} recipients for session ${sessionId}`,
    );

    return this.mapToResponse(saved);
  }

  /**
   * Get a single alert by name.
   *
   * @param name Alert name
   * @returns Alert details with recipient count
   * @throws NotFoundException if alert not found
   */
  async getAlertByName(name: string): Promise<BroadcastAlertResponseDto> {
    const alert = await this.alertRepository.findOne({
      where: { name, isDeleted: false },
    });

    if (!alert) {
      throw new NotFoundException(`Broadcast alert "${name}" not found`);
    }

    return this.mapToResponse(alert);
  }

  /**
   * Get a single alert by ID.
   *
   * @param id Alert UUID
   * @returns Alert details with recipient count
   * @throws NotFoundException if alert not found
   */
  async getAlertById(id: string): Promise<BroadcastAlertResponseDto> {
    const alert = await this.alertRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!alert) {
      throw new NotFoundException(`Broadcast alert with ID "${id}" not found`);
    }

    return this.mapToResponse(alert);
  }

  /**
   * List all active alerts for a session.
   *
   * @param sessionId Session UUID
   * @returns Array of alerts with total count
   */
  async listAlertsBySession(
    sessionId: string,
  ): Promise<{ alerts: BroadcastAlertResponseDto[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: { sessionId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return {
      alerts: alerts.map((alert) => this.mapToResponse(alert)),
      total,
    };
  }

  /**
   * List all active alerts across all sessions.
   *
   * @returns Array of all alerts with total count
   */
  async listAllAlerts(): Promise<{ alerts: BroadcastAlertResponseDto[]; total: number }> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return {
      alerts: alerts.map((alert) => this.mapToResponse(alert)),
      total,
    };
  }

  /**
   * Update an existing alert's phone numbers and/or description.
   *
   * @param name Alert name
   * @param updateDto Updated configuration
   * @returns Updated alert response
   * @throws NotFoundException if alert not found
   */
  async updateAlert(
    name: string,
    updateDto: UpdateBroadcastAlertDto,
  ): Promise<BroadcastAlertResponseDto> {
    const alert = await this.alertRepository.findOne({
      where: { name, isDeleted: false },
    });

    if (!alert) {
      throw new NotFoundException(`Broadcast alert "${name}" not found`);
    }

    // Update description if provided
    if (updateDto.description !== undefined) {
      alert.description = updateDto.description;
    }

    // Update and normalize chat IDs if phone numbers provided
    if (updateDto.phoneNumbers && updateDto.phoneNumbers.length > 0) {
      try {
        alert.chatIds = this.normalizePhoneNumbersToSet(updateDto.phoneNumbers);
        if (alert.chatIds.length === 0) {
          throw new BadRequestException('No valid phone numbers provided after normalization');
        }
      } catch (error) {
        throw new BadRequestException(
          `Phone number normalization failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const updated = await this.alertRepository.save(alert);
    this.logger.log(
      `Updated broadcast alert "${updated.name}" with ${updated.chatIds.length} recipients`,
    );

    return this.mapToResponse(updated);
  }

  /**
   * Soft delete an alert (mark as deleted but keep in database).
   *
   * @param name Alert name
   * @throws NotFoundException if alert not found
   */
  async deleteAlert(name: string): Promise<void> {
    const alert = await this.alertRepository.findOne({
      where: { name, isDeleted: false },
    });

    if (!alert) {
      throw new NotFoundException(`Broadcast alert "${name}" not found`);
    }

    alert.isDeleted = true;
    await this.alertRepository.save(alert);
    this.logger.log(`Deleted broadcast alert "${name}"`);
  }

  /**
   * Send a broadcast using a saved alert's recipient list.
   *
   * @param alertName Name of the saved alert
   * @param sendDto Message text and options
   * @returns Batch ID and recipient count for progress tracking
   * @throws NotFoundException if alert not found
   */
  async sendBroadcastAlert(
    alertName: string,
    sendDto: SendBroadcastAlertDto,
  ): Promise<SendBroadcastAlertResponseDto> {
    const alert = await this.alertRepository.findOne({
      where: { name: alertName, isDeleted: false },
    });

    if (!alert) {
      throw new NotFoundException(`Broadcast alert "${alertName}" not found`);
    }

    if (alert.chatIds.length === 0) {
      throw new BadRequestException(
        `Broadcast alert "${alertName}" has no recipients configured`,
      );
    }

    // Use existing broadcast service to send via saved chat IDs
    // Convert chat IDs back to array and send through bulk service
    const response = await this.broadcastMessageService.broadcastText(
      alert.sessionId,
      sendDto.text,
      alert.chatIds, // Pass already-normalized chat IDs
      {
        delayBetweenMessages: sendDto.delayBetweenMessages,
        randomizeDelay: sendDto.randomizeDelay,
        stopOnError: sendDto.stopOnError,
      },
      true, // isPreNormalized flag: skip normalization, use chat IDs as-is
    );

    this.logger.log(
      `Sent broadcast via alert "${alertName}" to ${alert.chatIds.length} recipients with batch ${response.batchId}`,
    );

    return {
      batchId: response.batchId,
      alertName,
      recipientCount: alert.chatIds.length,
      statusCode: 202,
      message: 'Broadcast accepted for processing',
    };
  }

  /**
   * Normalize phone numbers to a deduplicated set of chat IDs.
   * Uses Set to automatically remove duplicates.
   *
   * @param phoneOrChatIds Array of phone numbers or chat IDs
   * @returns Deduplicated array of normalized chat IDs
   */
  private normalizePhoneNumbersToSet(phoneOrChatIds: string[]): string[] {
    const normalized = new Set<string>();

    for (const item of phoneOrChatIds) {
      try {
        const chatId = this.broadcastMessageService['normalizePhoneNumber'](item);
        normalized.add(chatId);
      } catch (error) {
        // Continue with next number, but log invalid ones
        this.logger.warn(
          `Failed to normalize phone number "${item}": ${error instanceof Error ? error.message : String(error)}`,
        );
        // Still throw on invalid format to alert user
        throw error;
      }
    }

    return Array.from(normalized);
  }

  /**
   * Map BroadcastAlert entity to response DTO.
   */
  private mapToResponse(alert: BroadcastAlert): BroadcastAlertResponseDto {
    return {
      id: alert.id,
      name: alert.name,
      description: alert.description,
      sessionId: alert.sessionId,
      recipientCount: alert.chatIds.length,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}
