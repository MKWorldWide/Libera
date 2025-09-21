import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { AuthenticatedRequest } from './auth';

// Create Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'libera-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  logger.info('Request started', {
    timestamp,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as AuthenticatedRequest).user?.id
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as AuthenticatedRequest).user?.id
    });
  });

  next();
};

// Rate limiting middleware
export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  // Simple in-memory rate limiting (in production, use Redis)
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // limit each IP to 100 requests per windowMs

  const key = req.ip;
  const now = Date.now();

  // This is a simplified version - in production you'd want a proper rate limiting library
  // For now, we'll just log and allow all requests
  logger.debug(`Rate limit check for IP ${key}: allowing request`);

  next();
};
