import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || '172.17.0.1',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'dashboard',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
});

export { pool };
