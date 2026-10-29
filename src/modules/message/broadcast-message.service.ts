import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../session/entities/session.entity';
import { BulkMessageService } from './bulk-message.service';
import { SendBulkMessageDto } from './dto/bulk-message.dto';
import { BulkMessageResponseDto } from './dto/bulk-message.dto';

/**
 * Service for broadcasting the same message to multiple phone numbers.
 * Converts phone numbers to chat IDs and uses the existing BulkMessageService
 * with its smart pacing and batch processing.
 */
@Injectable()
export class BroadcastMessageService {
  constructor(
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
    private readonly bulkMessageService: BulkMessageService,
  ) {}

  /**
   * Resolve session by ID or name (case-sensitive exact match).
   * @param idOrName - Session UUID or session name
   * @returns Session ID (UUID)
   * @throws NotFoundException if session not found
   */
  async resolveSessionId(idOrName: string): Promise<string> {
    // Check if it looks like a UUID
    if (this.isUuid(idOrName)) {
      const session = await this.sessionRepository.findOne({ where: { id: idOrName } });
      if (session) return session.id;
    }

    // Try lookup by name (case-sensitive, exact match)
    const session = await this.sessionRepository.findOne({ where: { name: idOrName } });
    if (session) return session.id;

    throw new NotFoundException(`Session '${idOrName}' not found (use UUID or exact session name)`);
  }

  /**
   * Check if a string is a valid UUID.
   */
  private isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * Normalize and validate a phone number to a chat ID.
   * Accepts formats like:
   * - "85620123456789" → "85620123456789@c.us"
   * - "+855 20 123 456 789" → "85620123456789@c.us"
   * - "85620123456789@c.us" → "85620123456789@c.us" (pass-through)
   * - "628123456789@g.us" → "628123456789@g.us" (group, pass-through)
   *
   * @param phoneOrChatId - Phone number or chat ID
   * @returns Normalized chat ID
   * @throws BadRequestException if invalid
   */
  normalizePhoneNumber(phoneOrChatId: string): string {
    if (!phoneOrChatId || typeof phoneOrChatId !== 'string') {
      throw new BadRequestException('Phone number must be a non-empty string');
    }

    const trimmed = phoneOrChatId.trim();

    // If it's already a chat ID (contains @), validate and pass through
    if (trimmed.includes('@')) {
      if (this.isValidChatId(trimmed)) {
        return trimmed;
      }
      throw new BadRequestException(`Invalid chat ID format: ${trimmed}`);
    }

    // Extract only digits from phone number (removes +, spaces, parentheses, hyphens, etc.)
    const digits = trimmed.replace(/[^0-9]/g, '');

    // Validate digit count (minimum 6, maximum 15, matching WhatsApp requirements)
    if (digits.length < 6 || digits.length > 15) {
      throw new BadRequestException(
        `Phone number must have 6-15 digits, got ${digits.length}: ${trimmed}`,
      );
    }

    // Return as contact chat ID
    return `${digits}@c.us`;
  }

  /**
   * Check if a string is a valid WhatsApp chat ID.
   * Supports: user (@c.us), group (@g.us), and other WhatsApp server formats.
   */
  private isValidChatId(chatId: string): boolean {
    // Pattern from dashboard bulkRecipients.ts
    const CHAT_ID_PATTERN = /^[0-9][0-9:-]*@(c\.us|g\.us|s\.whatsapp\.net|lid|newsletter|broadcast)$/i;
    return CHAT_ID_PATTERN.test(chatId);
  }

  /**
   * Send the same text message to multiple phone numbers (broadcast).
   * Uses the existing bulk message service with smart pacing and batch processing.
   *
   * @param sessionIdOrName - Session UUID or session name (or UUID if isPreNormalized=true)
   * @param text - Text message to broadcast
   * @param phoneNumbers - Array of phone numbers, chat IDs, or pre-normalized chat IDs
   * @param options - Optional batch processing options
   *   - delayBetweenMessages: Delay in milliseconds (1000-60000, default 3000)
   *   - randomizeDelay: Add random 0-2s jitter (default true)
   *   - stopOnError: Stop on first error (default false)
   *   - batchId: Custom batch ID (auto-generated if not provided)
   * @param isPreNormalized - If true, skips normalization (phoneNumbers are already chat IDs)
   * @returns Batch response with status and tracking info
   * @throws BadRequestException if input validation fails
   * @throws NotFoundException if session not found
   */
  async broadcastText(
    sessionIdOrName: string,
    text: string,
    phoneNumbers: string[],
    options?: {
      delayBetweenMessages?: number;
      randomizeDelay?: boolean;
      stopOnError?: boolean;
      batchId?: string;
    },
    isPreNormalized?: boolean,
  ): Promise<any> {
    // Validate inputs
    if (!sessionIdOrName || typeof sessionIdOrName !== 'string') {
      throw new BadRequestException('Session ID or name is required');
    }

    if (!text || typeof text !== 'string') {
      throw new BadRequestException('Text message is required');
    }

    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      throw new BadRequestException('Phone numbers array is required and must not be empty');
    }

    if (phoneNumbers.length > 100) {
      throw new BadRequestException('Maximum 100 recipients per batch');
    }

    if (text.length > 65536) {
      throw new BadRequestException('Message text exceeds maximum length (65536 characters)');
    }

    // Resolve session by ID or name
    const sessionId = await this.resolveSessionId(sessionIdOrName);

    // Normalize all phone numbers to chat IDs (de-duplicate)
    const chatIds = new Set<string>();
    if (isPreNormalized) {
      // Skip normalization, use as-is (already validated when stored)
      for (const chatId of phoneNumbers) {
        chatIds.add(chatId);
      }
    } else {
      // Normalize and validate
      for (const phone of phoneNumbers) {
        chatIds.add(this.normalizePhoneNumber(phone));
      }
    }

    if (chatIds.size === 0) {
      throw new BadRequestException('No valid phone numbers after normalization');
    }

    // Build bulk message DTO with same content for all recipients
    const messages = Array.from(chatIds).map(chatId => ({
      chatId,
      type: 'text' as const,
      content: {
        text,
      },
    }));

    const bulkDto: SendBulkMessageDto = {
      messages,
      batchId: options?.batchId,
      options: {
        delayBetweenMessages: options?.delayBetweenMessages ?? 3000,
        randomizeDelay: options?.randomizeDelay ?? true,
        stopOnError: options?.stopOnError ?? false,
      },
    };

    // Use existing bulk message service with its smart pacing and batch processing
    return this.bulkMessageService.createBatch(sessionId, bulkDto);
  }

  /**
   * Same as broadcastText but accepts mentions to tag recipients.
   * Mentions will be applied to all recipients equally.
   *
   * @param mentions - Array of WID strings (e.g., ["628123456789@c.us", "628987654321@c.us"])
   */
  async broadcastTextWithMentions(
    sessionIdOrName: string,
    text: string,
    phoneNumbers: string[],
    mentions?: string[],
    options?: {
      delayBetweenMessages?: number;
      randomizeDelay?: boolean;
      stopOnError?: boolean;
      batchId?: string;
    },
  ): Promise<any> {
    // Validate inputs (same as broadcastText, plus mentions validation)
    if (!sessionIdOrName || typeof sessionIdOrName !== 'string') {
      throw new BadRequestException('Session ID or name is required');
    }

    if (!text || typeof text !== 'string') {
      throw new BadRequestException('Text message is required');
    }

    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      throw new BadRequestException('Phone numbers array is required and must not be empty');
    }

    if (phoneNumbers.length > 100) {
      throw new BadRequestException('Maximum 100 recipients per batch');
    }

    if (text.length > 65536) {
      throw new BadRequestException('Message text exceeds maximum length (65536 characters)');
    }

    if (mentions && mentions.length > 25) {
      throw new BadRequestException('Maximum 25 mentions per message');
    }

    // Validate mentions are valid WIDs
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        if (!this.isValidChatId(mention)) {
          throw new BadRequestException(`Invalid mention WID format: ${mention}`);
        }
      }
    }

    // Resolve session by ID or name
    const sessionId = await this.resolveSessionId(sessionIdOrName);

    // Normalize all phone numbers to chat IDs (de-duplicate)
    const chatIds = new Set<string>();
    for (const phone of phoneNumbers) {
      chatIds.add(this.normalizePhoneNumber(phone));
    }

    if (chatIds.size === 0) {
      throw new BadRequestException('No valid phone numbers after normalization');
    }

    // Build bulk message DTO with same content for all recipients
    const messages = Array.from(chatIds).map(chatId => ({
      chatId,
      type: 'text' as const,
      content: {
        text,
        ...(mentions && mentions.length > 0 && { mentions }),
      },
    }));

    const bulkDto: SendBulkMessageDto = {
      messages,
      batchId: options?.batchId,
      options: {
        delayBetweenMessages: options?.delayBetweenMessages ?? 3000,
        randomizeDelay: options?.randomizeDelay ?? true,
        stopOnError: options?.stopOnError ?? false,
      },
    };

    // Use existing bulk message service with its smart pacing and batch processing
    return this.bulkMessageService.createBatch(sessionId, bulkDto);
  }
}
