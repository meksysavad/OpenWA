import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BroadcastMessageService } from './broadcast-message.service';
import { BulkMessageService } from './bulk-message.service';
import { Session } from '../session/entities/session.entity';
import { SessionStatus } from '../session/entities/session.entity';
import { BatchStatus } from './entities/message-batch.entity';

describe('BroadcastMessageService', () => {
  let service: BroadcastMessageService;
  let sessionRepository: Repository<Session>;
  let bulkMessageService: BulkMessageService;

  const mockSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-session',
    status: SessionStatus.READY,
    phone: '628123456789',
    pushName: 'Test User',
    config: {},
    proxyUrl: null,
    proxyType: null,
    connectedAt: new Date(),
    lastActiveAt: new Date(),
    nodeId: null,
    nodeUrl: null,
    leaseExpiresAt: null,
    desiredState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Session;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastMessageService,
        {
          provide: getRepositoryToken(Session, 'data'),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: BulkMessageService,
          useValue: {
            createBatch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BroadcastMessageService>(BroadcastMessageService);
    sessionRepository = module.get<Repository<Session>>(getRepositoryToken(Session, 'data'));
    bulkMessageService = module.get<BulkMessageService>(BulkMessageService);
  });

  describe('resolveSessionId', () => {
    it('should resolve session by UUID', async () => {
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValueOnce(mockSession);

      const result = await service['resolveSessionId'](mockSession.id);
      expect(result).toBe(mockSession.id);
    });

    it('should resolve session by name', async () => {
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValueOnce(mockSession);

      const result = await service['resolveSessionId']('test-session');
      expect(result).toBe(mockSession.id);
    });

    it('should throw NotFoundException if session not found', async () => {
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValueOnce(null);

      await expect(service['resolveSessionId']('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize bare phone number', () => {
      const result = service['normalizePhoneNumber']('85620123456789');
      expect(result).toBe('85620123456789@c.us');
    });

    it('should normalize phone number with formatting', () => {
      const result = service['normalizePhoneNumber']('+855 (20) 123-456-789');
      expect(result).toBe('85620123456789@c.us');
    });

    it('should pass through valid chat IDs', () => {
      const result = service['normalizePhoneNumber']('628123456789@c.us');
      expect(result).toBe('628123456789@c.us');
    });

    it('should pass through group chat IDs', () => {
      const result = service['normalizePhoneNumber']('120363123456789@g.us');
      expect(result).toBe('120363123456789@g.us');
    });

    it('should throw on phone number with too few digits', () => {
      expect(() => service['normalizePhoneNumber']('12345')).toThrow(BadRequestException);
    });

    it('should throw on phone number with too many digits', () => {
      expect(() => service['normalizePhoneNumber']('1234567890123456')).toThrow(BadRequestException);
    });

    it('should throw on invalid chat ID', () => {
      expect(() => service['normalizePhoneNumber']('invalid@email.com')).toThrow(BadRequestException);
    });

    it('should throw on empty string', () => {
      expect(() => service['normalizePhoneNumber']('')).toThrow(BadRequestException);
    });
  });

  describe('broadcastText', () => {
    beforeEach(() => {
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession);
      jest.spyOn(bulkMessageService, 'createBatch').mockResolvedValue({
        id: 'id_123',
        batchId: 'batch_123',
        sessionId: mockSession.id,
        status: BatchStatus.PROCESSING,
        messages: [],
        options: {
          delayBetweenMessages: 3000,
          randomizeDelay: true,
          stopOnError: false,
        },
        progress: null,
        results: null,
        currentIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      } as any);
    });

    it('should broadcast text to multiple phone numbers', async () => {
      const result = await service.broadcastText(
        'test-session',
        'Hello everyone!',
        ['85620123456789', '628987654321', '+855 (20) 123-456-789'],
      );

      expect(result.batchId).toBe('batch_123');
      expect(result.status).toBe('PROCESSING');
      expect(result.totalMessages).toBe(3);

      expect(bulkMessageService.createBatch).toHaveBeenCalled();
      const callArgs = (bulkMessageService.createBatch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(mockSession.id);
      expect(callArgs[1].messages.length).toBe(3);
      expect(callArgs[1].messages[0].content.text).toBe('Hello everyone!');
    });

    it('should de-duplicate phone numbers', async () => {
      await service.broadcastText(
        'test-session',
        'Hello!',
        ['85620123456789', '85620123456789', '628987654321'],
      );

      const callArgs = (bulkMessageService.createBatch as jest.Mock).mock.calls[0];
      expect(callArgs[1].messages.length).toBe(2);
    });

    it('should use default pacing options', async () => {
      await service.broadcastText('test-session', 'Hello!', ['85620123456789']);

      const callArgs = (bulkMessageService.createBatch as jest.Mock).mock.calls[0];
      expect(callArgs[1].options.delayBetweenMessages).toBe(3000);
      expect(callArgs[1].options.randomizeDelay).toBe(true);
      expect(callArgs[1].options.stopOnError).toBe(false);
    });

    it('should accept custom pacing options', async () => {
      await service.broadcastText('test-session', 'Hello!', ['85620123456789'], {
        delayBetweenMessages: 5000,
        randomizeDelay: false,
        stopOnError: true,
      });

      const callArgs = (bulkMessageService.createBatch as jest.Mock).mock.calls[0];
      expect(callArgs[1].options.delayBetweenMessages).toBe(5000);
      expect(callArgs[1].options.randomizeDelay).toBe(false);
      expect(callArgs[1].options.stopOnError).toBe(true);
    });

    it('should throw on empty session ID', async () => {
      await expect(service.broadcastText('', 'Hello!', ['85620123456789'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on empty text', async () => {
      await expect(service.broadcastText('test-session', '', ['85620123456789'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on empty phone numbers array', async () => {
      await expect(service.broadcastText('test-session', 'Hello!', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on more than 100 recipients', async () => {
      const numbers = Array.from({ length: 101 }, (_, i) => `856${20000000000 + i}`);
      await expect(service.broadcastText('test-session', 'Hello!', numbers)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on text exceeding max length', async () => {
      const longText = 'a'.repeat(65537);
      await expect(
        service.broadcastText('test-session', longText, ['85620123456789']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('broadcastTextWithMentions', () => {
    beforeEach(() => {
      jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(mockSession);
      jest.spyOn(bulkMessageService, 'createBatch').mockResolvedValue({
        id: 'id_123',
        batchId: 'batch_123',
        sessionId: mockSession.id,
        status: BatchStatus.PROCESSING,
        messages: [],
        options: {
          delayBetweenMessages: 3000,
          randomizeDelay: true,
          stopOnError: false,
        },
        progress: null,
        results: null,
        currentIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      } as any);
    });

    it('should broadcast text with mentions', async () => {
      const result = await service.broadcastTextWithMentions(
        'test-session',
        'Hello @user1!',
        ['85620123456789', '628987654321'],
        ['628123456789@c.us'],
      );

      expect(result.batchId).toBe('batch_123');

      const callArgs = (bulkMessageService.createBatch as jest.Mock).mock.calls[0];
      expect(callArgs[1].messages[0].content.mentions).toEqual(['628123456789@c.us']);
    });

    it('should throw on invalid mention format', async () => {
      await expect(
        service.broadcastTextWithMentions(
          'test-session',
          'Hello!',
          ['85620123456789'],
          ['invalid@email.com'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw on more than 25 mentions', async () => {
      const mentions = Array.from({ length: 26 }, (_, i) => `${628123456700 + i}@c.us`);
      await expect(
        service.broadcastTextWithMentions(
          'test-session',
          'Hello!',
          ['85620123456789'],
          mentions,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isUuid', () => {
    it('should recognize valid UUID', () => {
      expect(service['isUuid']('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(service['isUuid']('not-a-uuid')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service['isUuid']('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });
  });

  describe('isValidChatId', () => {
    it('should validate contact chat ID', () => {
      expect(service['isValidChatId']('628123456789@c.us')).toBe(true);
    });

    it('should validate group chat ID', () => {
      expect(service['isValidChatId']('120363123456789@g.us')).toBe(true);
    });

    it('should validate WhatsApp.net server', () => {
      expect(service['isValidChatId']('628123456789@s.whatsapp.net')).toBe(true);
    });

    it('should validate newsletter', () => {
      expect(service['isValidChatId']('628123456789@newsletter')).toBe(true);
    });

    it('should validate broadcast', () => {
      expect(service['isValidChatId']('628123456789@broadcast')).toBe(true);
    });

    it('should reject invalid server', () => {
      expect(service['isValidChatId']('628123456789@invalid')).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(service['isValidChatId']('invalid@c.us')).toBe(false);
    });

    it('should be case-insensitive for server', () => {
      expect(service['isValidChatId']('628123456789@C.US')).toBe(true);
    });
  });
});
