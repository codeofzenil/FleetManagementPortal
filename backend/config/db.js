const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    }
  : {
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = pool;
