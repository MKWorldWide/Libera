import { Router } from 'express';
import { AlertModel } from '@/models/alert';
import { CaseModel } from '@/models/case';
import { EvidenceModel } from '@/models/evidence';
import { AuditModel } from '@/models/audit';
import { authenticateToken, requireRole, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, ValidationError, NotFoundError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// Get all alerts for a case
router.get('/case/:caseId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const alerts = await AlertModel.findByCase(caseId);

  res.json({ alerts });
}));

// Get alerts by severity
router.get('/case/:caseId/severity/:severity', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId, severity } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!['low', 'medium', 'high'].includes(severity)) {
    throw new ValidationError('Invalid severity level');
  }

  const alerts = await AlertModel.findBySeverity(caseId, severity as 'low' | 'medium' | 'high');

  res.json({ alerts });
}));

// Get pending alerts count
router.get('/case/:caseId/pending-count', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const count = await AlertModel.getPendingAlertsCount(caseId);

  res.json({ pendingCount: count });
}));

// Acknowledge an alert
router.put('/:alertId/acknowledge', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { alertId } = req.params;
  const { resolutionNotes } = req.body;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const alert = await AlertModel.findById(alertId);
  if (!alert) {
    throw new NotFoundError('Alert');
  }

  const updatedAlert = await AlertModel.acknowledge(alertId, req.user.id, resolutionNotes);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'alert_acknowledged',
    target_type: 'alert',
    target_id: alertId,
    details: {
      case_id: alert.case_id,
      severity: alert.severity,
      rule_id: alert.rule_id,
      resolution_notes: resolutionNotes
    }
  });

  res.json({
    message: 'Alert acknowledged successfully',
    alert: updatedAlert
  });
}));

// Resolve an alert
router.put('/:alertId/resolve', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { alertId } = req.params;
  const { resolutionNotes } = req.body;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!resolutionNotes) {
    throw new ValidationError('Resolution notes are required');
  }

  const alert = await AlertModel.findById(alertId);
  if (!alert) {
    throw new NotFoundError('Alert');
  }

  const updatedAlert = await AlertModel.resolve(alertId, resolutionNotes);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'alert_resolved',
    target_type: 'alert',
    target_id: alertId,
    details: {
      case_id: alert.case_id,
      severity: alert.severity,
      rule_id: alert.rule_id,
      resolution_notes: resolutionNotes
    }
  });

  res.json({
    message: 'Alert resolved successfully',
    alert: updatedAlert
  });
}));

// Dismiss an alert
router.put('/:alertId/dismiss', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { alertId } = req.params;
  const { reason } = req.body;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!reason) {
    throw new ValidationError('Dismissal reason is required');
  }

  const alert = await AlertModel.findById(alertId);
  if (!alert) {
    throw new NotFoundError('Alert');
  }

  const updatedAlert = await AlertModel.dismiss(alertId, reason);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'alert_dismissed',
    target_type: 'alert',
    target_id: alertId,
    details: {
      case_id: alert.case_id,
      severity: alert.severity,
      rule_id: alert.rule_id,
      reason: reason
    }
  });

  res.json({
    message: 'Alert dismissed successfully',
    alert: updatedAlert
  });
}));

// Get alerts by rule
router.get('/rule/:ruleId', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { ruleId } = req.params;
  const { limit } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const limitNum = limit ? parseInt(limit as string) : 50;
  const alerts = await AlertModel.getAlertsByRule(ruleId, limitNum);

  res.json({ alerts });
}));

// Export alerts for a case (counsel use)
router.get('/case/:caseId/export', authenticateToken, requireRole(['counsel', 'admin']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { caseId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const alerts = await AlertModel.findByCase(caseId);
  const caseData = await CaseModel.findById(caseId);

  if (!caseData) {
    throw new NotFoundError('Case');
  }

  // Generate export data
  const exportData = {
    caseNumber: caseData.case_number,
    exportDate: new Date().toISOString(),
    alerts: alerts.map(alert => ({
      id: alert.id,
      ruleId: alert.rule_id,
      severity: alert.severity,
      explanation: alert.explanation,
      evidenceRefs: alert.evidence_refs,
      createdAt: alert.created_by_system_at,
      status: alert.status,
      acknowledgedBy: alert.acknowledged_by,
      acknowledgedAt: alert.acknowledged_at,
      resolutionNotes: alert.resolution_notes
    }))
  };

  res.json({
    message: 'Alerts exported successfully',
    exportData
  });
}));

export { router as alertRoutes };
