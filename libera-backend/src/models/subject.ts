import { pool } from './database';
import { logger } from '@/utils/logger';
import * as crypto from 'crypto';

export interface Subject {
  id: string;
  name_hash: string;
  contact_hash?: string;
  consent_status: 'pending' | 'granted' | 'revoked';
  consent_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubjectData {
  name: string;
  contact?: string;
}

export class SubjectModel {
  // Hash sensitive data using SHA-256
  private static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static async create(data: CreateSubjectData): Promise<Subject> {
    const client = await pool.connect();

    try {
      const nameHash = this.hashData(data.name);
      const contactHash = data.contact ? this.hashData(data.contact) : null;

      const query = `
        INSERT INTO subjects (name_hash, contact_hash)
        VALUES ($1, $2)
        RETURNING *
      `;

      const values = [nameHash, contactHash];
      const result = await client.query(query, values);

      logger.info(`Subject created with hash: ${nameHash.substring(0, 8)}...`);
      return this.mapRowToSubject(result.rows[0]);
    } catch (error) {
      logger.error('Error creating subject:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<Subject | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM subjects WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToSubject(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding subject by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find subject by name hash (for deduplication)
  static async findByNameHash(nameHash: string): Promise<Subject | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM subjects WHERE name_hash = $1';
      const result = await client.query(query, [nameHash]);

      return result.rows.length > 0 ? this.mapRowToSubject(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding subject by name hash:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateConsentStatus(id: string, status: Subject['consent_status'], consentTimestamp?: Date): Promise<Subject> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE subjects
        SET consent_status = $2, consent_timestamp = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const values = [id, status, consentTimestamp];
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Subject not found');
      }

      logger.info(`Subject ${id} consent status updated to ${status}`);
      return this.mapRowToSubject(result.rows[0]);
    } catch (error) {
      logger.error('Error updating subject consent status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const query = 'DELETE FROM subjects WHERE id = $1';
      const result = await client.query(query, [id]);

      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info(`Subject ${id} deleted`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting subject:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get subjects requiring consent renewal (older than 1 year)
  static async getSubjectsRequiringConsentRenewal(): Promise<Subject[]> {
    const client = await pool.connect();

    try {
      const query = `
        SELECT * FROM subjects
        WHERE consent_status = 'granted'
        AND consent_timestamp < NOW() - INTERVAL '1 year'
      `;

      const result = await client.query(query);
      return result.rows.map(this.mapRowToSubject);
    } catch (error) {
      logger.error('Error getting subjects requiring consent renewal:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToSubject(row: any): Subject {
    return {
      id: row.id,
      name_hash: row.name_hash,
      contact_hash: row.contact_hash,
      consent_status: row.consent_status,
      consent_timestamp: row.consent_timestamp,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
