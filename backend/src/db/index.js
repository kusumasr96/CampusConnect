const { Pool } = require('pg');
require('../config/loadEnv');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || undefined,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'campusconnect_db',
      },
);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
