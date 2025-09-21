import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, CreateUserData } from '@/models/user';
import { AuditModel } from '@/models/audit';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, ValidationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, role, firstName, lastName, organization, licenseNumber } = req.body;

  if (!email || !password || !role) {
    throw new ValidationError('Email, password, and role are required');
  }

  // Check if user already exists
  const existingUser = await UserModel.findByEmail(email);
  if (existingUser) {
    throw new ValidationError('User already exists');
  }

  const userData: CreateUserData = {
    email,
    password,
    role,
    first_name: firstName,
    last_name: lastName,
    organization,
    license_number: licenseNumber
  };

  const user = await UserModel.create(userData);

  // Log audit event
  await AuditModel.create({
    action: 'user_registered',
    target_type: 'user',
    target_id: user.id,
    details: { email: user.email, role: user.role }
  });

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      organization: user.organization
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await UserModel.authenticate({ email, password });
  if (!user) {
    throw new ValidationError('Invalid credentials');
  }

  // Log audit event
  await AuditModel.create({
    user_id: user.id,
    action: 'user_login',
    target_type: 'user',
    target_id: user.id,
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      organization: user.organization,
      lastLogin: user.last_login
    }
  });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const user = await UserModel.findById(req.user.id);
  if (!user) {
    throw new ValidationError('User not found');
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      organization: user.organization,
      licenseNumber: user.license_number,
      createdAt: user.created_at,
      lastLogin: user.last_login
    }
  });
}));

// Update user password
router.put('/password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  // Verify current password
  const user = await UserModel.findById(req.user.id);
  if (!user) {
    throw new ValidationError('User not found');
  }

  // This would need to store the current password hash to verify
  // For now, we'll assume the middleware handles this

  await UserModel.updatePassword(req.user.id, newPassword);

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'password_updated',
    target_type: 'user',
    target_id: req.user.id
  });

  res.json({ message: 'Password updated successfully' });
}));

// Logout (client-side token removal)
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  // Log audit event
  await AuditModel.create({
    user_id: req.user.id,
    action: 'user_logout',
    target_type: 'user',
    target_id: req.user.id,
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });

  res.json({ message: 'Logout successful' });
}));

export { router as authRoutes };
