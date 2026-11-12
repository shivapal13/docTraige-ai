import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { DocumentStatus, UrgencyTier } from '@prisma/client';
import { AiClientService } from '../ai-client/ai-client.service';
import { TriageGateway } from '../triage-gateway/triage-gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TraigeJobPayload } from './triage.processor';

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly aiClient: AiClientService,
    private readonly triageGateway: TriageGateway,
    @InjectQueue('triage-document-queue') private readonly triageQueue: Queue<TraigeJobPayload>,
  ) {}

  /**
   * Processes a newly uploaded file and strictly binds it to the clinician's hospital.
   * Fail-closed: Rejects intake if hospitalId is absent.
   * Orphan-protected: If Redis is down, marks document FAILED immediately.
   */
  async processFileUpload(file: Express.Multer.File, hospitalId?: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    if (!hospitalId) {
      throw new ForbiddenException('Tenancy violation: Cannot intake documents without a verified hospital tenant.');
    }

    this.logger.log(`Received file upload: ${file.originalname} (${file.size} bytes) for Hospital ID: ${hospitalId}`);

    // 1. Create Initial Document Record in DB scoped to hospital
    const document = await this.prisma.document.create({
      data: {
        filename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: DocumentStatus.QUEUED,
        urgency: UrgencyTier.ROUTINE,
        hospitalId,
      },
    });

    this.logger.log(`Document record created in DB with ID: ${document.id} [Hospital: ${hospitalId}]`);

    // 2. Trigger processing asynchronously in BullMQ (with orphan prevention)
    let job;
    try {
      job = await this.triageQueue.add(
        'process-document',
        {
          documentId: document.id,
          filePath: file.path,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
        },
      );
    } catch (queueErr) {
      this.logger.error(`Failed to push document ${document.id} to BullMQ queue: ${(queueErr as Error).message}`);
      // Mark as failed in DB to prevent stuck QUEUED orphan rows
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
      throw new ServiceUnavailableException('Triage processing queue is temporarily unavailable. Document intake failed.');
    }

    this.logger.log(`Pushed Document ${document.id} to BullMQ Redis Queue. Job ID ${job.id}`);

    // 3. Real-time WebSocket: Broadcast new queued document scoped to hospital room
    try {
      this.triageGateway.broadcastQueueUpdate(
        {
          id: document.id,
          filename: document.filename,
          status: document.status,
          urgency: document.urgency,
          createdAt: document.createdAt,
        },
        hospitalId,
      );
    } catch (wsErr) {
      this.logger.warn(`Initial intake WebSocket broadcast failed: ${(wsErr as Error).message}`);
    }

    return {
      message: 'Document successfully queued for triage.',
      documentId: document.id,
      jobId: job.id,
      filename: document.filename,
      status: document.status,
    };
  }

  // Internal pipeline: Simulates OCR/Extraction + Rule Engine evaluation
  async processDocumentPipeline(documentId: string, filePath: string) {
    try {
      const existingDoc = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, hospitalId: true },
      });

      if (!existingDoc?.hospitalId) {
        throw new Error(`Security violation: Document ${documentId} has no associated hospital tenant.`);
      }
      const hospitalScope = existingDoc.hospitalId;

      // 1. Update status to PROCESSING and notify connected hospital clients
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      try {
        this.triageGateway.broadcastQueueUpdate(
          {
            id: documentId,
            status: DocumentStatus.PROCESSING,
          },
          hospitalScope,
        );
      } catch (e) {
        this.logger.warn(`Processing status broadcast failed: ${(e as Error).message}`);
      }

      // 2. Delegate Network call to Python FastAPI AI Engine
      const ai_data = await this.aiClient.processDocument({
        documentId,
        filePath,
      });

      if (ai_data.status === 'FAILED') {
        throw new Error(`AI engine failed: ${ai_data.error_message}`);
      }

      this.logger.log(
        `Received AI engine Response For Doc ${documentId} | ` +
        `Extracted Labs: ${ai_data.extracted_labs?.length || 0}, ` +
        `Red Flags: ${ai_data.red_flag_phrases?.length || 0}`,
      );

      const extractedLabs = ai_data.extracted_labs || [];
      const redFlagsPhrases = ai_data.red_flag_phrases || [];
      const patientInfo = ai_data.patient_info || {};

      // 3. Clinical Rule Engine Evaluation
      const ruleResult = this.ruleEngine.evaluateClinicalData(extractedLabs, redFlagsPhrases);

      // 4. ATOMIC DATABASE TRANSACTION (Idempotent across BullMQ retries)
      const updatedDoc = await this.prisma.$transaction(async (tx) => {
        // Upsert extraction results
        await tx.extractionResult.upsert({
          where: { documentId },
          create: {
            documentId,
            patientName: patientInfo.name || 'Unknown Patient',
            mrn: patientInfo.mrn || 'N/A',
            dob: patientInfo.dob || 'N/A',
            documentType: 'Clinical Intake Document',
            rawText: ai_data.raw_text || '',
            extractedLabValues: extractedLabs as any,
            flaggedPhrases: redFlagsPhrases as any,
          },
          update: {
            patientName: patientInfo.name || 'Unknown Patient',
            mrn: patientInfo.mrn || 'N/A',
            dob: patientInfo.dob || 'N/A',
            rawText: ai_data.raw_text || '',
            extractedLabValues: extractedLabs as any,
            flaggedPhrases: redFlagsPhrases as any,
          },
        });

        // Clean up prior rule matches if this is a retried attempt
        await tx.ruleMatch.deleteMany({
          where: { documentId },
        });

        // Save new matched panic rules
        if (ruleResult.matchedRules.length > 0) {
          await tx.ruleMatch.createMany({
            data: ruleResult.matchedRules.map((rule) => ({
              documentId,
              ruleName: rule.ruleName,
              testName: rule.testName,
              foundValue: rule.foundValue,
              threshold: rule.threshold,
              severity: rule.severity,
              description: rule.description,
            })),
          });
        }

        // Atomically update document status and final urgency
        return tx.document.update({
          where: { id: documentId },
          data: {
            status: DocumentStatus.PROCESSED,
            urgency: ruleResult.overallUrgency,
          },
          include: {
            ruleMatches: true,
            extractionResult: true,
          },
        });
      }, {
        maxWait: 15000,
        timeout: 30000,
      });

      this.logger.log(
        `Pipeline Finished for Doc ${documentId}! Urgency: ${updatedDoc.urgency}, Matched Rules: ${ruleResult.matchedRules.length}`,
      );

      // 5. SYNCHRONIZED WEBSOCKET BROADCASTS (SCOPED TO HOSPITAL TENANT ROOM):
      // Wrapped in try/catch so a socket error never burns retries after a successful DB commit
      try {
        this.triageGateway.broadcastQueueUpdate(
          {
            id: updatedDoc.id,
            filename: updatedDoc.filename,
            status: updatedDoc.status,
            urgency: updatedDoc.urgency,
            patientName: updatedDoc.extractionResult?.patientName || 'Unknown Patient',
            mrn: updatedDoc.extractionResult?.mrn || 'N/A',
            matchedRulesCount: ruleResult.matchedRules.length,
          },
          updatedDoc.hospitalId || undefined,
        );

        if (updatedDoc.urgency === UrgencyTier.STAT) {
          this.triageGateway.broadcastStatAlert(
            {
              id: updatedDoc.id,
              filename: updatedDoc.filename,
              patientName: updatedDoc.extractionResult?.patientName || 'Unknown Patient',
              mrn: updatedDoc.extractionResult?.mrn || 'N/A',
              urgency: 'STAT',
              matchedRules: ruleResult.matchedRules,
            },
            updatedDoc.hospitalId || undefined,
          );
        }
      } catch (broadcastErr) {
        this.logger.warn(`WebSocket notification failed after DB transaction: ${(broadcastErr as Error).message}. DB transaction is safe.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in document pipeline: ${message}`);
      // Allow BullMQ retry backoff to attempt recovery if the DB or AI engine failed.
      throw error;
    }
  }

  // Called when all BullMQ worker retries are exhausted
  async markDocumentFailed(documentId: string, errorReason: string) {
    try {
      const updated = await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.FAILED },
      });
      try {
        this.triageGateway.broadcastQueueUpdate(
          {
            id: updated.id,
            filename: updated.filename,
            status: updated.status,
            urgency: updated.urgency,
            error: errorReason,
          },
          updated.hospitalId || undefined,
        );
      } catch (e) {
        this.logger.warn(`Failed broadcast for doc failure: ${(e as Error).message}`);
      }
      this.logger.warn(`Document ${documentId} marked as FAILED in database.`);
    } catch (err) {
      this.logger.error(`Failed to mark document ${documentId} as FAILED: ${(err as Error).message}`);
    }
  }

  /**
   * Retrieves all documents strictly scoped to the clinician's hospital.
   * Fail-closed: Rejects with 403 Forbidden if hospitalId is absent.
   */
  async getAllDocuments(hospitalId?: string) {
    if (!hospitalId) {
      throw new ForbiddenException('Tenancy violation: Clinician account is not bound to a verified hospital.');
    }

    return this.prisma.document.findMany({
      where: { hospitalId },
      orderBy: [
        { urgency: 'asc' }, // STAT -> URGENT -> ROUTINE
        { createdAt: 'desc' },
      ],
      include: {
        ruleMatches: true,
        extractionResult: true,
      },
    });
  }

  /**
   * Retrieves a single document by ID, enforcing strict hospital tenant isolation.
   * Fail-closed: Returns 404 if the document belongs to a different hospital.
   */
  async getDocumentById(id: string, hospitalId?: string) {
    if (!hospitalId) {
      throw new ForbiddenException('Tenancy violation: Clinician account is not bound to a verified hospital.');
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: {
        ruleMatches: true,
        extractionResult: true,
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found in this hospital workspace.`);
    }

    return doc;
  }
}
