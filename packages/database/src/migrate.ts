import dotenv from 'dotenv';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

async function runMigrations() {
  const databaseUrl = process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:')
    .replace('.supabase.co', '.supabase.co:5432/postgres');
  
  if (!databaseUrl) {
    throw new Error('SUPABASE_URL not set');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT filename FROM migrations'
    );
    const executed = new Set(executedMigrations.map(row => row.filename));

    // Get migration files
    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Run pending migrations
    for (const file of sqlFiles) {
      if (!executed.has(file)) {
        console.log(`Running migration: ${file}`);
        
        const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
        
        // Start transaction
        await client.query('BEGIN');
        
        try {
          // Run migration
          await client.query(sql);
          
          // Record migration
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          
          // Commit transaction
          await client.query('COMMIT');
          console.log(`✓ Migration ${file} completed`);
        } catch (error) {
          // Rollback on error
          await client.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`✓ Migration ${file} already executed`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations().catch(console.error);