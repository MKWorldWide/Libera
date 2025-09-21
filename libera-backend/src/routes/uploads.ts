import { Router } from 'express';
import multer from 'multer';
import { UploadModel, CreateUploadData } from '@/models/upload';
import { EvidenceModel, CreateEvidenceData } from '@/models/evidence';
import { CaseModel } from '@/models/case';
import { AuditModel } from '@/models/audit';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import * as crypto from 'crypto';
import * as path from 'path';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/avi', 'video/mov',
      'audio/mpeg', 'audio/wav',
      'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Generate secure upload URL
router.post('/:caseId/upload-url', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;
  const { filename, fileType } = req.body;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!filename || !fileType) {
    throw new ValidationError('Filename and file type are required');
  }

  // Verify case exists
  const caseData = await CaseModel.findById(caseId);
  if (!caseData) {
    throw new NotFoundError('Case');
  }

  // Generate file hash for deduplication
  const fileHash = crypto.createHash('sha256').update(filename + Date.now()).digest('hex');

  // In production, this would generate a signed S3 upload URL
  const uploadUrl = `/api/uploads/${caseId}/${fileHash}`;

  res.json({
    uploadUrl,
    fileId: fileHash,
    expiresIn: 3600 // 1 hour
  });
}));

// Handle file upload
router.post('/:caseId', authenticateToken, upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;
  const file = req.file;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  // Verify case exists
  const caseData = await CaseModel.findById(caseId);
  if (!caseData) {
    throw new NotFoundError('Case');
  }

  // Calculate file hash
  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  // Check for duplicate uploads
  const existingUpload = await UploadModel.findByHash(fileHash);
  if (existingUpload) {
    throw new ValidationError('File already exists');
  }

  // Create upload record
  const uploadData: CreateUploadData = {
    case_id: caseId,
    uploader_id: req.user.id,
    file_type: file.mimetype.startsWith('image/') ? 'image' :
                file.mimetype === 'application/pdf' ? 'pdf' :
                file.mimetype.startsWith('video/') ? 'video' :
                file.mimetype.startsWith('audio/') ? 'audio' : 'document',
    original_filename: file.originalname,
    file_hash: fileHash,
    metadata_json: {
      size: file.size,
      mimetype: file.mimetype,
      upload_timestamp: new Date().toISOString()
    }
  };

  const upload = await UploadModel.create(uploadData);

  // Extract metadata and create evidence item
  const evidenceData: CreateEvidenceData = {
    case_id: caseId,
    upload_id: upload.id,
    type: uploadData.file_type === 'image' ? 'photo' :
          uploadData.file_type === 'video' ? 'video' :
          uploadData.file_type === 'audio' ? 'audio' : 'document',
    owner_source: req.user.email,
    timestamp: new Date()
  };

  const evidence = await EvidenceModel.create(evidenceData);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'file_uploaded',
    target_type: 'upload',
    target_id: upload.id,
    details: {
      case_id: caseId,
      filename: file.originalname,
      size: file.size,
      evidence_id: evidence.id
    }
  });

  // In production, you'd upload to S3 here
  // For now, we'll store in memory (not recommended for production)

  res.status(201).json({
    message: 'File uploaded successfully',
    upload: {
      id: upload.id,
      filename: upload.original_filename,
      type: upload.file_type,
      size: file.size
    },
    evidence: {
      id: evidence.id,
      type: evidence.type
    }
  });
}));

// Get upload by ID
router.get('/:uploadId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { uploadId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const upload = await UploadModel.findById(uploadId);
  if (!upload) {
    throw new NotFoundError('Upload');
  }

  res.json({ upload });
}));

// Download file (placeholder)
router.get('/:uploadId/download', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { uploadId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const upload = await UploadModel.findById(uploadId);
  if (!upload) {
    throw new NotFoundError('Upload');
  }

  // In production, this would serve the file from S3
  // For now, return a placeholder
  res.json({
    message: 'Download would be served from S3',
    upload: upload
  });
}));

export { router as uploadRoutes };
