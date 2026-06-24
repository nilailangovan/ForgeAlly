const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'forgeally',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'yourpassword',
});

// Helper for executing queries
const query = (text, params) => pool.query(text, params);

// Initialize DB tables if they don't exist
const initDb = async () => {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(50) UNIQUE NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createOtpTableQuery = `
    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(50) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `;

  try {
    await query(createUsersTableQuery);
    console.log('PostgreSQL "users" table initialized or already exists.');
    await query(createOtpTableQuery);
    console.log('PostgreSQL "otp_codes" table initialized or already exists.');
  } catch (err) {
    console.error('Error initializing database tables:', err.message);
    // Since PostgreSQL might not be running or database might not exist yet,
    // we log the error but don't crash the server, giving the user flexibility.
  }
};

// Execute initialization
initDb();

module.exports = {
  pool,
  query,
  initDb
};
