import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeadLetterPayload } from './triage.processor';
import { PrismaService } from '../prisma/prisma.service';
import { TriageGateway } from '../triage-gateway/triage-gateway';

@Processor('triage-dead-letter-queue')
export class DlqProcessor extends WorkerHost {
  private readonly logger = new Logger(DlqProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triageGateway: TriageGateway,
  ) {
    super();
  }

  async process(job: Job<DeadLetterPayload>): Promise<any> {
    const { documentId, errorReason, failedAt, originalJobId } = job.data;

    this.logger.error(
      `[CRITICAL DLQ INCIDENT] Document ID ${documentId} failed automated triage and entered DLQ! ` +
      `Original Job ID: ${originalJobId} | Reason: ${errorReason} | FailedAt: ${failedAt}`
    );

    try {
      // Find document to resolve associated hospital tenant
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, filename: true, hospitalId: true },
      });

      if (doc?.hospitalId) {
        // Emit high-priority administrative alert to that hospital's socket room
        this.triageGateway.broadcastQueueUpdate(
          {
            id: doc.id,
            filename: doc.filename,
            status: 'FAILED',
            urgency: 'STAT', // Escalate unprocessable failures for urgent manual review
            errorMessage: `Automated processing exhausted all retries: ${errorReason}. Manual review mandated.`,
          },
          doc.hospitalId,
        );
      }
    } catch (err) {
      this.logger.error(`Error notifying clinicians about DLQ document ${documentId}: ${(err as Error).message}`);
    }

    return { status: 'ARCHIVED', documentId, processedAt: new Date().toISOString() };
  }
}
