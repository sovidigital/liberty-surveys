#!/usr/bin/env node

/**
 * Simple database migration script for Liberty Surveys
 * 
 * Usage: 
 *   DATABASE_URL=postgres://... node scripts/migrate.js
 *   npm run db:migrate
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.log('\nUsage: DATABASE_URL=postgres://user:pass@host:port/db node scripts/migrate.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('Connected successfully!\n');

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in migrations/');
      return;
    }

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await pool.query(sql);
      console.log(`  ✓ ${file} completed\n`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
