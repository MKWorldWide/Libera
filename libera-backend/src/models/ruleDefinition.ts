import { pool } from './database';
import { logger } from '@/utils/logger';

export interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  yaml_definition: string;
  owner: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRuleDefinitionData {
  id: string;
  name: string;
  description?: string;
  yaml_definition: string;
  owner: string;
  active?: boolean;
}

export class RuleDefinitionModel {
  static async create(data: CreateRuleDefinitionData): Promise<RuleDefinition> {
    const client = await pool.connect();

    try {
      const query = `
        INSERT INTO rule_defs (id, name, description, yaml_definition, owner, active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        data.id,
        data.name,
        data.description,
        data.yaml_definition,
        data.owner,
        data.active !== undefined ? data.active : true
      ];

      const result = await client.query(query, values);

      logger.info(`Rule definition created: ${data.name} (${data.id})`);
      return this.mapRowToRuleDefinition(result.rows[0]);
    } catch (error) {
      logger.error('Error creating rule definition:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<RuleDefinition | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM rule_defs WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToRuleDefinition(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding rule definition by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findAllActive(): Promise<RuleDefinition[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM rule_defs WHERE active = true ORDER BY created_at DESC';
      const result = await client.query(query);

      return result.rows.map(this.mapRowToRuleDefinition);
    } catch (error) {
      logger.error('Error finding all active rule definitions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByOwner(owner: string): Promise<RuleDefinition[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM rule_defs WHERE owner = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [owner]);

      return result.rows.map(this.mapRowToRuleDefinition);
    } catch (error) {
      logger.error('Error finding rule definitions by owner:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(id: string, updates: Partial<RuleDefinition>): Promise<RuleDefinition> {
    const client = await pool.connect();

    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);

      if (fields.length === 0) {
        throw new Error('No updates provided');
      }

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const query = `
        UPDATE rule_defs
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id, ...values]);

      if (result.rows.length === 0) {
        throw new Error('Rule definition not found');
      }

      logger.info(`Rule definition updated: ${id}`);
      return this.mapRowToRuleDefinition(result.rows[0]);
    } catch (error) {
      logger.error('Error updating rule definition:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deactivate(id: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const query = 'UPDATE rule_defs SET active = false, updated_at = NOW() WHERE id = $1';
      const result = await client.query(query, [id]);

      const deactivated = result.rowCount > 0;
      if (deactivated) {
        logger.info(`Rule definition deactivated: ${id}`);
      }

      return deactivated;
    } catch (error) {
      logger.error('Error deactivating rule definition:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      const query = 'DELETE FROM rule_defs WHERE id = $1';
      const result = await client.query(query, [id]);

      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info(`Rule definition deleted: ${id}`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error deleting rule definition:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Validate YAML syntax
  static validateYamlDefinition(yamlContent: string): { valid: boolean; error?: string } {
    try {
      const parsed = require('js-yaml').load(yamlContent);

      // Basic structure validation
      if (!parsed.name || !parsed.when || !parsed.actions) {
        return { valid: false, error: 'Rule must have name, when conditions, and actions' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `YAML syntax error: ${error.message}` };
    }
  }

  // Get rule statistics
  static async getRuleStats(): Promise<{
    totalRules: number;
    activeRules: number;
    rulesByOwner: Record<string, number>;
  }> {
    const client = await pool.connect();

    try {
      const query = 'SELECT owner, active, COUNT(*) as count FROM rule_defs GROUP BY owner, active';
      const result = await client.query(query);

      const stats = {
        totalRules: 0,
        activeRules: 0,
        rulesByOwner: {} as Record<string, number>
      };

      result.rows.forEach(row => {
        stats.totalRules += parseInt(row.count);
        if (row.active) {
          stats.activeRules += parseInt(row.count);
        }

        if (!stats.rulesByOwner[row.owner]) {
          stats.rulesByOwner[row.owner] = 0;
        }
        stats.rulesByOwner[row.owner] += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting rule statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToRuleDefinition(row: any): RuleDefinition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      yaml_definition: row.yaml_definition,
      owner: row.owner,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
