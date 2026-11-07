import { Injectable, Logger, BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AiProcessRequestDTO {
  documentId: string;
  filePath: string;
}

export interface AiPatientInfo {
  name?: string;
  mrn?: string;
  dob?: string;
}

export interface AiLabItem {
  test: string;
  value: number;
  unit?: string;
}

export interface AiRedFlagItem {
  phrase: string;
  category: string;
  confidence: number;
  status?: string;
}

export interface AiProcessResponseDTO {
  document_id: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string;
  patient_info: AiPatientInfo;
  extracted_labs: AiLabItem[];
  red_flag_phrases: string[];
  red_flags?: AiRedFlagItem[];
  raw_text: string;
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly aiEngineUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {

    // Read AI Engine URL from .env or default to http://localhost:8000

    this.aiEngineUrl =
      this.configService.get<string>('AI_ENGINE_URL') || 'http://localhost:8000';
  }

   //sends a document processing request to the FastAPI AI Microservice Engine with automatic 60s timeout & 3x exponential backoff retries.

  async processDocument(payload: AiProcessRequestDTO): Promise<AiProcessResponseDTO> {
    const targetUrl = `${this.aiEngineUrl}/api/v1/process-document`;
    this.logger.log(
      `Dispatching Document ID: ${payload.documentId} to AI Engine at: ${targetUrl}`
    );

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<AiProcessResponseDTO>(
            targetUrl,
            {
              document_id: payload.documentId,
              file_path: payload.filePath,
            },
            {
              timeout: 60000, // 60 seconds timeout
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'NestJS-WebGateway-Microservice/1.0',
              },
            }
          )
          .pipe(
            catchError((err) => {
              this.logger.error(
                `Network communication error with FastAPI AI Engine: ${err.message}`
              );
              if (err.code === 'ECONNABORTED') {
                return throwError(
                  () => new GatewayTimeoutException('AI Engine processing timed out after 60 seconds.')
                );
              }
              return throwError(
                () => new BadGatewayException(`Failed to communicate with AI Engine: ${err.message}`)
              );
            })
          )
      );

      this.logger.log(
        `Received successful AI response for Document ID: ${payload.documentId}`
      );
      return response.data;
    } catch (error) {
      this.logger.error(`AiClientService Error: ${(error as Error).message}`);
      throw error;
    }
  }
}