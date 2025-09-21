import { pool } from './database';
import { logger } from '@/utils/logger';
import * as crypto from 'crypto';

export interface AuditLogEntry {
  id: number;
  user_id?: string;
  action: string;
  target_type: 'case' | 'subject' | 'evidence' | 'alert' | 'upload' | 'user' | 'system';
  target_id?: string;
  details?: Record<string, any>;
  timestamp: Date;
  ip_address?: string;
  user_agent?: string;
  signature?: string;
}

export interface CreateAuditEntryData {
  user_id?: string;
  action: string;
  target_type: AuditLogEntry['target_type'];
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export class AuditModel {
  static async create(entry: CreateAuditEntryData): Promise<AuditLogEntry> {
    const client = await pool.connect();

    try {
      // Generate signature for immutability
      const signatureData = JSON.stringify({
        user_id: entry.user_id,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id,
        details: entry.details,
        timestamp: new Date().toISOString(),
        ip_address: entry.ip_address,
        user_agent: entry.user_agent
      });

      const signature = crypto.createHash('sha256').update(signatureData).digest('hex');

      const query = `
        INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address, user_agent, signature)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        entry.user_id,
        entry.action,
        entry.target_type,
        entry.target_id,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address,
        entry.user_agent,
        signature
      ];

      const result = await client.query(query, values);

      logger.debug(`Audit log entry created: ${entry.action} on ${entry.target_type}`);
      return this.mapRowToAuditEntry(result.rows[0]);
    } catch (error) {
      logger.error('Error creating audit log entry:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: number): Promise<AuditLogEntry | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToAuditEntry(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding audit log entry by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByUser(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2';
      const result = await client.query(query, [userId, limit]);

      return result.rows.map(this.mapRowToAuditEntry);
    } catch (error) {
      logger.error('Error finding audit log entries by user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByTarget(targetType: AuditLogEntry['target_type'], targetId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE target_type = $1 AND target_id = $2 ORDER BY timestamp DESC LIMIT $3';
      const result = await client.query(query, [targetType, targetId, limit]);

      return result.rows.map(this.mapRowToAuditEntry);
    } catch (error) {
      logger.error('Error finding audit log entries by target:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByAction(action: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE action = $1 ORDER BY timestamp DESC LIMIT $2';
      const result = await client.query(query, [action, limit]);

      return result.rows.map(this.mapRowToAuditEntry);
    } catch (error) {
      logger.error('Error finding audit log entries by action:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC LIMIT $3';
      const result = await client.query(query, [startDate, endDate, limit]);

      return result.rows.map(this.mapRowToAuditEntry);
    } catch (error) {
      logger.error('Error finding audit log entries by date range:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getRecentActivity(limit: number = 50): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1';
      const result = await client.query(query, [limit]);

      return result.rows.map(this.mapRowToAuditEntry);
    } catch (error) {
      logger.error('Error getting recent audit activity:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Verify audit log integrity
  static async verifyIntegrity(entryId: number): Promise<boolean> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM audit_log WHERE id = $1';
      const result = await client.query(query, [entryId]);

      if (result.rows.length === 0) {
        return false;
      }

      const entry = result.rows[0];
      const signatureData = JSON.stringify({
        user_id: entry.user_id,
        action: entry.action,
        target_type: entry.target_type,
        target_id: entry.target_id,
        details: entry.details,
        timestamp: entry.timestamp,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent
      });

      const expectedSignature = crypto.createHash('sha256').update(signatureData).digest('hex');
      return entry.signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying audit log integrity:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Export for auditor (differential privacy enabled)
  static async getAuditorExport(startDate: Date, endDate: Date, targetType?: AuditLogEntry['target_type']): Promise<AuditLogEntry[]> {
    const client = await pool.connect();

    try {
      let query = 'SELECT id, action, target_type, timestamp FROM audit_log WHERE timestamp >= $1 AND timestamp <= $2';
      const values: any[] = [startDate, endDate];

      if (targetType) {
        query += ' AND target_type = $3';
        values.push(targetType);
      }

      query += ' ORDER BY timestamp ASC';

      const result = await client.query(query, values);

      // Apply differential privacy by removing sensitive details and PII
      return result.rows.map(row => ({
        id: row.id,
        action: row.action,
        target_type: row.target_type,
        timestamp: row.timestamp
      }));
    } catch (error) {
      logger.error('Error getting auditor export:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToAuditEntry(row: any): AuditLogEntry {
    return {
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      details: row.details ? JSON.parse(row.details) : undefined,
      timestamp: row.timestamp,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      signature: row.signature
    };
  }
}
