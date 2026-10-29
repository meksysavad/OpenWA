import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageSendService } from './message-send.service';
import { BulkMessageService } from './bulk-message.service';
import { BroadcastMessageService } from './broadcast-message.service';
import { BroadcastAlertService } from './broadcast-alert.service';
import { MessageTypeBackfillService } from './message-type-backfill.service';
import { PendingMessageReaperService } from './pending-message-reaper.service';
import { MessageRetentionService } from './message-retention.service';
import { MessageController } from './message.controller';
import { BroadcastController } from './broadcast.controller';
import { BroadcastAlertController } from './broadcast-alert.controller';
import { SessionModule } from '../session/session.module';
import { TemplateModule } from '../template/template.module';
import { ChatMediaModule } from '../chat-media/chat-media.module';
import { Message } from './entities/message.entity';
import { Session } from '../session/entities/session.entity';
import { SendPacingService } from './send-pacing.service';
import { MessageBatch } from './entities/message-batch.entity';
import { SendIdempotencyKey } from './entities/send-idempotency-key.entity';
import { BroadcastAlert } from './entities/broadcast-alert.entity';
import { SendIdempotencyService } from './idempotency/send-idempotency.service';
import { SendIdempotencyInterceptor } from './idempotency/send-idempotency.interceptor';
import { PLUGIN_MESSAGE_PORT } from '../../core/plugins/plugin-host-ports';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageBatch, Session, SendIdempotencyKey, BroadcastAlert], 'data'),
    SessionModule,
    TemplateModule,
    ChatMediaModule,
  ],
  controllers: [MessageController, BroadcastController, BroadcastAlertController],
  providers: [
    MessageService,
    MessageSendService,
    BulkMessageService,
    BroadcastMessageService,
    BroadcastAlertService,
    MessageTypeBackfillService,
    PendingMessageReaperService,
    MessageRetentionService,
    SendPacingService,
    SendIdempotencyService,
    SendIdempotencyInterceptor,
    // Binds the core-owned plugin capability port to this module's service. The plugin runtime
    // resolves the token lazily via ModuleRef (PluginHostServices), which keeps its provider cycle
    // broken; this adapter is how core reaches the service without importing it.
    // An alias, not a factory, so lifecycle hooks are not dispatched twice on the same instance.
    { provide: PLUGIN_MESSAGE_PORT, useExisting: MessageService },
  ],
  exports: [MessageService, BulkMessageService, BroadcastMessageService, BroadcastAlertService, SendPacingService],
})
export class MessageModule {}
