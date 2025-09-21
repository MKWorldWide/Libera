import { Router } from 'express';
import { CaseModel, CreateCaseData } from '@/models/case';
import { SubjectModel, CreateSubjectData } from '@/models/subject';
import { EvidenceModel } from '@/models/evidence';
import { AlertModel } from '@/models/alert';
import { AuditModel } from '@/models/audit';
import { authenticateToken, requireRole, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// Get all cases for authenticated user
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  // For now, return all cases (in production, filter by user's cases)
  // This would need to be implemented based on case assignments

  const cases = await CaseModel.findBySubject('all'); // Placeholder

  res.json({ cases });
}));

// Get case by ID
router.get('/:caseId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const caseData = await CaseModel.findById(caseId);
  if (!caseData) {
    throw new NotFoundError('Case');
  }

  // Get associated evidence
  const evidence = await EvidenceModel.findByCase(caseId);

  // Get alerts
  const alerts = await AlertModel.findByCase(caseId);

  res.json({
    case: caseData,
    evidence: evidence,
    alerts: alerts
  });
}));

// Create new case
router.post('/', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const { caseNumber, subjectName, subjectContact, counselId } = req.body;

  if (!caseNumber || !subjectName) {
    throw new ValidationError('Case number and subject name are required');
  }

  // Create or find subject
  const subjectData: CreateSubjectData = {
    name: subjectName,
    contact: subjectContact
  };

  let subject = await SubjectModel.findByNameHash(
    SubjectModel['hashData'](subjectName)
  );

  if (!subject) {
    subject = await SubjectModel.create(subjectData);
  }

  // Create case
  const caseData: CreateCaseData = {
    case_number: caseNumber,
    subject_id: subject.id,
    counsel_id: counselId || req.user.id
  };

  const caseRecord = await CaseModel.create(caseData);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'case_created',
    target_type: 'case',
    target_id: caseRecord.id,
    details: {
      case_number: caseRecord.case_number,
      subject_id: subject.id
    }
  });

  res.status(201).json({
    message: 'Case created successfully',
    case: caseRecord
  });
}));

// Update case status
router.put('/:caseId/status', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;
  const { status } = req.body;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!status || !['active', 'closed', 'archived'].includes(status)) {
    throw new ValidationError('Invalid status');
  }

  const updatedCase = await CaseModel.updateStatus(caseId, status);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'case_status_updated',
    target_type: 'case',
    target_id: caseId,
    details: { old_status: 'unknown', new_status: status }
  });

  res.json({
    message: 'Case status updated successfully',
    case: updatedCase
  });
}));

// Get case timeline
router.get('/:caseId/timeline', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const evidence = await EvidenceModel.findByCase(caseId);

  // Create timeline from evidence items
  const timeline = evidence.map(item => ({
    id: item.id,
    type: 'evidence',
    timestamp: item.timestamp,
    title: `${item.type} - ${item.owner_source}`,
    description: item.extracted_text?.substring(0, 200) || 'No description available',
    data: item
  }));

  // Sort by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({ timeline });
}));

// Search evidence in case
router.get('/:caseId/evidence/search', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;
  const { q: query } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!query || typeof query !== 'string') {
    throw new ValidationError('Search query is required');
  }

  const evidence = await EvidenceModel.searchByText(caseId, query);

  res.json({ evidence });
}));

export { router as caseRoutes };
