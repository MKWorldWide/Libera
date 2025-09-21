import { pool } from './database';
import { logger } from '@/utils/logger';

export interface Upload {
  id: string;
  case_id: string;
  uploader_id: string;
  file_type: 'image' | 'pdf' | 'video' | 'audio' | 'document';
  original_filename: string;
  s3_path?: string;
  file_hash: string;
  metadata_json?: Record<string, any>;
  created_at: Date;
}

export interface CreateUploadData {
  case_id: string;
  uploader_id: string;
  file_type: Upload['file_type'];
  original_filename: string;
  s3_path?: string;
  file_hash: string;
  metadata_json?: Record<string, any>;
}

export class UploadModel {
  static async create(data: CreateUploadData): Promise<Upload> {
    const client = await pool.connect();

    try {
      const query = `
        INSERT INTO uploads (case_id, uploader_id, file_type, original_filename, s3_path, file_hash, metadata_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        data.case_id,
        data.uploader_id,
        data.file_type,
        data.original_filename,
        data.s3_path,
        data.file_hash,
        data.metadata_json ? JSON.stringify(data.metadata_json) : null
      ];

      const result = await client.query(query, values);

      logger.info(`Upload created: ${data.original_filename} (${data.file_hash.substring(0, 8)}...)`);
      return this.mapRowToUpload(result.rows[0]);
    } catch (error) {
      logger.error('Error creating upload:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<Upload | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM uploads WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToUpload(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding upload by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByCase(caseId: string): Promise<Upload[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM uploads WHERE case_id = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [caseId]);

      return result.rows.map(this.mapRowToUpload);
    } catch (error) {
      logger.error('Error finding uploads by case:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByHash(fileHash: string): Promise<Upload | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM uploads WHERE file_hash = $1';
      const result = await client.query(query, [fileHash]);

      return result.rows.length > 0 ? this.mapRowToUpload(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding upload by hash:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByUploader(uploaderId: string): Promise<Upload[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM uploads WHERE uploader_id = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [uploaderId]);

      return result.rows.map(this.mapRowToUpload);
    } catch (error) {
      logger.error('Error finding uploads by uploader:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const query = 'DELETE FROM uploads WHERE id = $1';
      const result = await client.query(query, [id]);

      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info(`Upload ${id} deleted`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting upload:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get upload statistics
  static async getUploadStats(caseId?: string): Promise<{
    totalUploads: number;
    totalSize: number;
    byType: Record<string, number>;
  }> {
    const client = await pool.connect();

    try {
      let query = 'SELECT file_type, COUNT(*) as count, SUM(metadata_json->>\'size\')::bigint as total_size FROM uploads';
      const values: any[] = [];

      if (caseId) {
        query += ' WHERE case_id = $1';
        values.push(caseId);
      }

      query += ' GROUP BY file_type';

      const result = await client.query(query, values);

      const stats = {
        totalUploads: 0,
        totalSize: 0,
        byType: {} as Record<string, number>
      };

      result.rows.forEach(row => {
        stats.totalUploads += parseInt(row.count);
        stats.totalSize += parseInt(row.total_size || 0);
        stats.byType[row.file_type] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting upload stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToUpload(row: any): Upload {
    return {
      id: row.id,
      case_id: row.case_id,
      uploader_id: row.uploader_id,
      file_type: row.file_type,
      original_filename: row.original_filename,
      s3_path: row.s3_path,
      file_hash: row.file_hash,
      metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      created_at: row.created_at
    };
  }
}
