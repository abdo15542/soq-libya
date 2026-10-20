require('dotenv').config();
const { Pool } = require('pg');
const { encryptIdentity, PREFIX } = require('../utils/identity-crypto');

async function migrateIdentityDocuments() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  // Validate the key before opening a transaction or touching any records.
  encryptIdentity('key-validation');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000
  });
  const client = await pool.connect();
  let migrated = 0;
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const result = await client.query(
      "SELECT id, id_image, selfie_image FROM users WHERE (id_image IS NOT NULL AND id_image NOT LIKE $1) OR (selfie_image IS NOT NULL AND selfie_image NOT LIKE $1) ORDER BY id FOR UPDATE",
      [PREFIX + '%']
    );
    for (const row of result.rows) {
      const idImage = row.id_image && !row.id_image.startsWith(PREFIX) ? encryptIdentity(row.id_image) : row.id_image;
      const selfieImage = row.selfie_image && !row.selfie_image.startsWith(PREFIX) ? encryptIdentity(row.selfie_image) : row.selfie_image;
      await client.query('UPDATE users SET id_image = $1, selfie_image = $2 WHERE id = $3', [idImage, selfieImage, row.id]);
      migrated += 1;
    }
    await client.query('COMMIT');
    console.log('Identity document migration complete. Records updated:', migrated);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateIdentityDocuments().catch(error => {
    console.error('Identity document migration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { migrateIdentityDocuments };
