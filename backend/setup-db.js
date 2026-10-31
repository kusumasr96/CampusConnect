const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('./src/config/loadEnv');

async function setup() {
  const dbName = process.env.DB_NAME || 'campusconnect_db';
  const databaseUrl = process.env.DATABASE_URL;
  const maintenanceConfig = databaseUrl
    ? { connectionString: getConnectionString(databaseUrl, 'postgres') }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || undefined,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: 'postgres',
      };

  const adminClient = new Client(maintenanceConfig);

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL server...');

    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (res.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
      console.log(`Database "${dbName}" created successfully!`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }

    const databaseClient = new Client(
      databaseUrl
        ? { connectionString: getConnectionString(databaseUrl, dbName) }
        : { ...maintenanceConfig, database: dbName },
    );
    try {
      await databaseClient.connect();
      const schema = fs.readFileSync(
        path.join(__dirname, 'src', 'db', 'schema.sql'),
        'utf8',
      );
      await databaseClient.query(schema);
      console.log(`Database "${dbName}" schema is ready.`);
    } finally {
      await databaseClient.end();
    }
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exitCode = 1;
  } finally {
    await adminClient.end();
  }
}

function getConnectionString(connectionString, database) {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

setup();