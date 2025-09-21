import { pool } from './database';
import { logger } from '@/utils/logger';

export interface Alert {
  id: string;
  case_id: string;
  rule_id: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  evidence_refs?: string[];
  created_by_system_at: Date;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolution_notes?: string;
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
}

export interface CreateAlertData {
  case_id: string;
  rule_id: string;
  severity: Alert['severity'];
  explanation: string;
  evidence_refs?: string[];
}

export class AlertModel {
  static async create(data: CreateAlertData): Promise<Alert> {
    const client = await pool.connect();

    try {
      const query = `
        INSERT INTO alerts (case_id, rule_id, severity, explanation, evidence_refs)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        data.case_id,
        data.rule_id,
        data.severity,
        data.explanation,
        data.evidence_refs ? JSON.stringify(data.evidence_refs) : null
      ];

      const result = await client.query(query, values);

      logger.info(`Alert created: ${data.rule_id} for case ${data.case_id} (severity: ${data.severity})`);
      return this.mapRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<Alert | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM alerts WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToAlert(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding alert by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByCase(caseId: string, status?: Alert['status']): Promise<Alert[]> {
    const client = await pool.connect();

    try {
      let query = 'SELECT * FROM alerts WHERE case_id = $1';
      const values: any[] = [caseId];

      if (status) {
        query += ' AND status = $2';
        values.push(status);
      }

      query += ' ORDER BY severity DESC, created_by_system_at DESC';

      const result = await client.query(query, values);
      return result.rows.map(this.mapRowToAlert);
    } catch (error) {
      logger.error('Error finding alerts by case:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findBySeverity(caseId: string, severity: Alert['severity']): Promise<Alert[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM alerts WHERE case_id = $1 AND severity = $2 ORDER BY created_by_system_at DESC';
      const result = await client.query(query, [caseId, severity]);

      return result.rows.map(this.mapRowToAlert);
    } catch (error) {
      logger.error('Error finding alerts by severity:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async acknowledge(alertId: string, userId: string, resolutionNotes?: string): Promise<Alert> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE alerts
        SET acknowledged_by = $2, acknowledged_at = NOW(), resolution_notes = $3, status = 'acknowledged'
        WHERE id = $1
        RETURNING *
      `;

      const values = [alertId, userId, resolutionNotes];
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Alert not found');
      }

      logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
      return this.mapRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async resolve(alertId: string, resolutionNotes: string): Promise<Alert> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE alerts
        SET resolution_notes = $2, status = 'resolved'
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [alertId, resolutionNotes]);

      if (result.rows.length === 0) {
        throw new Error('Alert not found');
      }

      logger.info(`Alert ${alertId} resolved`);
      return this.mapRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async dismiss(alertId: string, reason: string): Promise<Alert> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE alerts
        SET resolution_notes = $2, status = 'dismissed'
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [alertId, `Dismissed: ${reason}`]);

      if (result.rows.length === 0) {
        throw new Error('Alert not found');
      }

      logger.info(`Alert ${alertId} dismissed: ${reason}`);
      return this.mapRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error dismissing alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getPendingAlertsCount(caseId: string): Promise<number> {
    const client = await pool.connect();

    try {
      const query = 'SELECT COUNT(*) FROM alerts WHERE case_id = $1 AND status = $2';
      const result = await client.query(query, [caseId, 'pending']);

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting pending alerts count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAlertsByRule(ruleId: string, limit: number = 50): Promise<Alert[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM alerts WHERE rule_id = $1 ORDER BY created_by_system_at DESC LIMIT $2';
      const result = await client.query(query, [ruleId, limit]);

      return result.rows.map(this.mapRowToAlert);
    } catch (error) {
      logger.error('Error getting alerts by rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      case_id: row.case_id,
      rule_id: row.rule_id,
      severity: row.severity,
      explanation: row.explanation,
      evidence_refs: row.evidence_refs ? JSON.parse(row.evidence_refs) : undefined,
      created_by_system_at: row.created_by_system_at,
      acknowledged_by: row.acknowledged_by,
      acknowledged_at: row.acknowledged_at,
      resolution_notes: row.resolution_notes,
      status: row.status
    };
  }
}
