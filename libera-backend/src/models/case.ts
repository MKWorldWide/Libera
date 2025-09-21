import { pool } from './database';
import { logger } from '@/utils/logger';

export interface Case {
  id: string;
  case_number: string;
  subject_id: string;
  counsel_id?: string;
  status: 'active' | 'closed' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface CreateCaseData {
  case_number: string;
  subject_id: string;
  counsel_id?: string;
}

export class CaseModel {
  static async create(data: CreateCaseData): Promise<Case> {
    const client = await pool.connect();

    try {
      const query = `
        INSERT INTO cases (case_number, subject_id, counsel_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

      const values = [data.case_number, data.subject_id, data.counsel_id];
      const result = await client.query(query, values);

      logger.info(`Case created: ${data.case_number}`);
      return this.mapRowToCase(result.rows[0]);
    } catch (error) {
      logger.error('Error creating case:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<Case | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM cases WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToCase(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding case by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByCaseNumber(caseNumber: string): Promise<Case | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM cases WHERE case_number = $1';
      const result = await client.query(query, [caseNumber]);

      return result.rows.length > 0 ? this.mapRowToCase(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding case by case number:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findBySubject(subjectId: string): Promise<Case[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM cases WHERE subject_id = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [subjectId]);

      return result.rows.map(this.mapRowToCase);
    } catch (error) {
      logger.error('Error finding cases by subject:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateStatus(id: string, status: Case['status']): Promise<Case> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE cases
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id, status]);
      if (result.rows.length === 0) {
        throw new Error('Case not found');
      }

      logger.info(`Case ${id} status updated to ${status}`);
      return this.mapRowToCase(result.rows[0]);
    } catch (error) {
      logger.error('Error updating case status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToCase(row: any): Case {
    return {
      id: row.id,
      case_number: row.case_number,
      subject_id: row.subject_id,
      counsel_id: row.counsel_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
