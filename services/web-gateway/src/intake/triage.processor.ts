import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IntakeService } from './intake.service';

export interface TraigeJobPayload {
  documentId: string;
  filePath: string;
}

export interface DeadLetterPayload {
  originalJobId: string;
  documentId: string;
  filePath: string;
  errorReason: string;
  failedAt: string;
}

@Processor('triage-document-queue')
export class DocTraigeProcessor extends WorkerHost {
  private readonly logger = new Logger(DocTraigeProcessor.name);

  constructor(
    private readonly intakeService: IntakeService,
    @InjectQueue('triage-dead-letter-queue') private readonly dlQueue: Queue<DeadLetterPayload>, 
  ) {
    super();
  }

  async process(job: Job<TraigeJobPayload, any, string>): Promise<any> {
    this.logger.log(
      `[BullMQ Worker] Processing Job ID: ${job.id} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3}) for Doc: ${job.data.documentId}`
    );

    const { documentId, filePath } = job.data;
    await this.intakeService.processDocumentPipeline(documentId, filePath);

    return { status: 'COMPLETED', documentId };
  }

  
   // BullMQ Worker Failure Handler:
    // Listens for job failures. If all retries are exhausted, moves the job to Dead-Letter Queue!
   
  @OnWorkerEvent('failed')
  async onJobFailed(job: Job<TraigeJobPayload>, error: Error) {
    const attempts = job.opts.attempts || 3;

    this.logger.error(
      `[BullMQ Worker Failure] Job ID: ${job.id} failed attempt ${job.attemptsMade}/${attempts}: ${error.message}`
    );

    // If max retries exhausted -> Move to Dead-Letter Queue (DLQ)

    if (job.attemptsMade >= attempts) {
      this.logger.error(
        `[DEAD-LETTER QUEUE ALERT] Job ID: ${job.id} EXHAUSTED ALL ${attempts} RETRIES! Moving Document ${job.data.documentId} to DLQ.`
      );

      // Mark status as FAILED in DB and notify frontend via WebSocket
      await this.intakeService.markDocumentFailed(job.data.documentId, error.message);

      await this.dlQueue.add('dead-letter-job', {
        originalJobId: job.id || 'unknown',
        documentId: job.data.documentId,
        filePath: job.data.filePath,
        errorReason: error.message,
        failedAt: new Date().toISOString(),
      });

      this.logger.log(`Job successfully archived in Dead-Letter Queue (DLQ) for audit.`);
    }
  }
}