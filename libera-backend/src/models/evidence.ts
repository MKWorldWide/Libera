import { pool } from './database';
import { logger } from '@/utils/logger';

export interface EvidenceItem {
  id: string;
  case_id: string;
  upload_id?: string;
  type: 'document' | 'photo' | 'video' | 'audio' | 'physical_item' | 'digital_record' | 'witness_statement';
  extracted_text?: string;
  timestamp?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    description?: string;
  };
  owner_source: string;
  chain_of_custody_json?: ChainOfCustodyEntry[];
  created_at: Date;
  updated_at: Date;
}

export interface ChainOfCustodyEntry {
  timestamp: Date;
  custodian: string;
  action: 'collected' | 'transferred' | 'analyzed' | 'stored' | 'returned';
  location?: string;
  notes?: string;
  digital_signature?: string;
}

export interface CreateEvidenceData {
  case_id: string;
  upload_id?: string;
  type: EvidenceItem['type'];
  extracted_text?: string;
  timestamp?: Date;
  location?: EvidenceItem['location'];
  owner_source: string;
  chain_of_custody?: ChainOfCustodyEntry[];
}

export class EvidenceModel {
  static async create(data: CreateEvidenceData): Promise<EvidenceItem> {
    const client = await pool.connect();

    try {
      const query = `
        INSERT INTO evidence_items (case_id, upload_id, type, extracted_text, timestamp, location, owner_source, chain_of_custody_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        data.case_id,
        data.upload_id,
        data.type,
        data.extracted_text,
        data.timestamp,
        data.location ? JSON.stringify(data.location) : null,
        data.owner_source,
        data.chain_of_custody ? JSON.stringify(data.chain_of_custody) : null
      ];

      const result = await client.query(query, values);

      logger.info(`Evidence item created: ${data.type} for case ${data.case_id}`);
      return this.mapRowToEvidence(result.rows[0]);
    } catch (error) {
      logger.error('Error creating evidence item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<EvidenceItem | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM evidence_items WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToEvidence(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding evidence by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByCase(caseId: string): Promise<EvidenceItem[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM evidence_items WHERE case_id = $1 ORDER BY timestamp ASC, created_at ASC';
      const result = await client.query(query, [caseId]);

      return result.rows.map(this.mapRowToEvidence);
    } catch (error) {
      logger.error('Error finding evidence by case:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByType(caseId: string, type: EvidenceItem['type']): Promise<EvidenceItem[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM evidence_items WHERE case_id = $1 AND type = $2 ORDER BY timestamp ASC, created_at ASC';
      const result = await client.query(query, [caseId, type]);

      return result.rows.map(this.mapRowToEvidence);
    } catch (error) {
      logger.error('Error finding evidence by type:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateChainOfCustody(evidenceId: string, chainOfCustody: ChainOfCustodyEntry[]): Promise<EvidenceItem> {
    const client = await pool.connect();

    try {
      const query = `
        UPDATE evidence_items
        SET chain_of_custody_json = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [evidenceId, JSON.stringify(chainOfCustody)]);

      if (result.rows.length === 0) {
        throw new Error('Evidence item not found');
      }

      logger.info(`Chain of custody updated for evidence ${evidenceId}`);
      return this.mapRowToEvidence(result.rows[0]);
    } catch (error) {
      logger.error('Error updating chain of custody:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async searchByText(caseId: string, searchTerm: string): Promise<EvidenceItem[]> {
    const client = await pool.connect();

    try {
      const query = `
        SELECT * FROM evidence_items
        WHERE case_id = $1
        AND (
          extracted_text ILIKE $2
          OR owner_source ILIKE $2
          OR type::text ILIKE $2
        )
        ORDER BY timestamp ASC, created_at ASC
      `;

      const searchPattern = `%${searchTerm}%`;
      const result = await client.query(query, [caseId, searchPattern]);

      return result.rows.map(this.mapRowToEvidence);
    } catch (error) {
      logger.error('Error searching evidence by text:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Detect chain of custody gaps > 24 hours
  static async findEvidenceWithCustodyGaps(caseId: string): Promise<EvidenceItem[]> {
    const client = await pool.connect();

    try {
      const query = `
        SELECT * FROM evidence_items
        WHERE case_id = $1
        AND type = 'physical_item'
        AND chain_of_custody_json IS NOT NULL
        AND jsonb_array_length(chain_of_custody_json) > 1
      `;

      const result = await client.query(query, [caseId]);
      const evidenceItems = result.rows.map(this.mapRowToEvidence);

      // Filter items with gaps > 24 hours
      return evidenceItems.filter(item => {
        if (!item.chain_of_custody_json || item.chain_of_custody_json.length < 2) {
          return false;
        }

        const entries = item.chain_of_custody_json.sort(
          (a: ChainOfCustodyEntry, b: ChainOfCustodyEntry) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        for (let i = 1; i < entries.length; i++) {
          const gapMs = new Date(entries[i].timestamp).getTime() - new Date(entries[i-1].timestamp).getTime();
          const gapHours = gapMs / (1000 * 60 * 60);

          if (gapHours > 24) {
            return true;
          }
        }

        return false;
      });
    } catch (error) {
      logger.error('Error finding evidence with custody gaps:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToEvidence(row: any): EvidenceItem {
    return {
      id: row.id,
      case_id: row.case_id,
      upload_id: row.upload_id,
      type: row.type,
      extracted_text: row.extracted_text,
      timestamp: row.timestamp,
      location: row.location ? JSON.parse(row.location) : undefined,
      owner_source: row.owner_source,
      chain_of_custody_json: row.chain_of_custody_json ? JSON.parse(row.chain_of_custody_json) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
