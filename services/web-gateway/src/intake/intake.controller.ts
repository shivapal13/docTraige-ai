import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';

// Ensure shared_uploads folder exists
const uploadsDir = path.resolve(__dirname, '../../../shared_uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

@Controller('api/v1/documents')
@UseGuards(JwtAuthGuard)
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  /**
   * POST /api/v1/documents/upload
   * Accepts universal document uploads (.pdf, .png, .jpg, .tiff, .docx, .txt)
   * Scoped to the authenticated clinician's hospital.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
          return callback(
            new BadRequestException(
              `File extension ${ext} is not supported. Allowed extensions: ${allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max file size
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.intakeService.processFileUpload(file, user?.hospitalId);
  }

  /**
   * GET /api/v1/documents
   * Returns documents sorted for clinician triage, scoped to their hospital.
   */
  @Get()
  async getAllDocuments(@CurrentUser() user: CurrentUserPayload) {
    return this.intakeService.getAllDocuments(user?.hospitalId);
  }

  /**
   * GET /api/v1/documents/:id
   * Returns single document details with extraction and rule matches, enforcing hospital tenant check.
   */
  @Get(':id')
  async getDocumentById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.intakeService.getDocumentById(id, user?.hospitalId);
  }
}
