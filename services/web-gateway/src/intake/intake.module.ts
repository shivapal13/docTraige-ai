import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';
import { TriageGatewayModule } from '../triage-gateway/triage-gateway.module';
import { AiClientModule } from '../ai-client/ai-client.module';
import { BullModule } from '@nestjs/bullmq';
import { DocTraigeProcessor } from './triage.processor';
import { DlqProcessor } from './dlq.processor';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [RuleEngineModule, TriageGatewayModule,AiClientModule,AuthModule,
  BullModule.registerQueue({
    name:'triage-document-queue',
  }) ,
  BullModule.registerQueue({
    name:'triage-dead-letter-queue'
  }) ,
  ],
  controllers: [IntakeController],
  providers: [IntakeService, DocTraigeProcessor, DlqProcessor],
})
export class IntakeModule {}