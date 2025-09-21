import { Router } from 'express';
import { AuditModel } from '@/models/audit';
import { authenticateToken, requireRole, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, ValidationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// Get recent audit activity
router.get('/recent', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { limit } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const limitNum = limit ? parseInt(limit as string) : 50;
  const activities = await AuditModel.getRecentActivity(limitNum);

  res.json({ activities });
}));

// Get audit entries by user
router.get('/user/:userId', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  const { limit } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const limitNum = limit ? parseInt(limit as string) : 100;
  const activities = await AuditModel.findByUser(userId, limitNum);

  res.json({ activities });
}));

// Get audit entries by target
router.get('/target/:targetType/:targetId', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { targetType, targetId } = req.params;
  const { limit } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const limitNum = limit ? parseInt(limit as string) : 50;
  const activities = await AuditModel.findByTarget(targetType as any, targetId, limitNum);

  res.json({ activities });
}));

// Get audit entries by action
router.get('/action/:action', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { action } = req.params;
  const { limit } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const limitNum = limit ? parseInt(limit as string) : 50;
  const activities = await AuditModel.findByAction(action, limitNum);

  res.json({ activities });
}));

// Get audit entries by date range
router.get('/date-range', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { startDate, endDate, targetType } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  const activities = await AuditModel.findByDateRange(start, end, targetType as any);

  res.json({ activities });
}));

// Verify audit log integrity
router.get('/verify/:entryId', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { entryId } = req.params;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const entryIdNum = parseInt(entryId);
  if (isNaN(entryIdNum)) {
    throw new ValidationError('Invalid entry ID');
  }

  const isValid = await AuditModel.verifyIntegrity(entryIdNum);

  res.json({
    entryId: entryIdNum,
    isValid,
    verifiedAt: new Date().toISOString()
  });
}));

// Export audit data for external auditors
router.get('/export', authenticateToken, requireRole(['auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { startDate, endDate, targetType } = req.query;

  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  const exportData = await AuditModel.getAuditorExport(start, end, targetType as any);

  res.json({
    exportId: `audit-export-${Date.now()}`,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    recordsCount: exportData.length,
    exportData,
    exportedAt: new Date().toISOString()
  });
}));

// Get audit statistics
router.get('/stats', authenticateToken, requireRole(['admin', 'auditor']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  // This would aggregate statistics from the audit log
  // For now, return placeholder data
  const stats = {
    totalEntries: 0,
    entriesByAction: {},
    entriesByUser: {},
    entriesByDate: {},
    recentActivity: []
  };

  res.json({ stats });
}));

export { router as auditRoutes };
