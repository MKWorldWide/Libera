import { pool } from './database';
import { logger } from '@/utils/logger';
import * as bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  role: 'counsel' | 'advocate' | 'auditor' | 'admin';
  first_name?: string;
  last_name?: string;
  organization?: string;
  license_number?: string;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  role: User['role'];
  first_name?: string;
  last_name?: string;
  organization?: string;
  license_number?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class UserModel {
  static async create(data: CreateUserData): Promise<User> {
    const client = await pool.connect();

    try {
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      const query = `
        INSERT INTO users (email, password_hash, role, first_name, last_name, organization, license_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        data.email,
        passwordHash,
        data.role,
        data.first_name,
        data.last_name,
        data.organization,
        data.license_number
      ];

      const result = await client.query(query, values);

      logger.info(`User created: ${data.email} (${data.role})`);
      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await client.query(query, [email]);

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<User | null> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await client.query(query, [id]);

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async authenticate(credentials: LoginCredentials): Promise<User | null> {
    const client = await pool.connect();

    try {
      const user = await this.findByEmail(credentials.email);
      if (!user) {
        return null;
      }

      const query = 'SELECT password_hash FROM users WHERE id = $1';
      const result = await client.query(query, [user.id]);

      if (result.rows.length === 0) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(credentials.password, result.rows[0].password_hash);
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(user.id);

      logger.info(`User authenticated: ${credentials.email}`);
      return user;
    } catch (error) {
      logger.error('Error authenticating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateLastLogin(userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
      await client.query(query, [userId]);
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const client = await pool.connect();

    try {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      const query = 'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1';
      await client.query(query, [userId, passwordHash]);

      logger.info(`Password updated for user ${userId}`);
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByRole(role: User['role']): Promise<User[]> {
    const client = await pool.connect();

    try {
      const query = 'SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [role]);

      return result.rows.map(this.mapRowToUser);
    } catch (error) {
      logger.error('Error finding users by role:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      organization: row.organization,
      license_number: row.license_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login: row.last_login
    };
  }
}
