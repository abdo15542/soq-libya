const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (typeof secret !== 'string' || secret.length < 32 || secret === '32characterslongsecretkeyhere!') {
    throw new Error('ENCRYPTION_KEY must be a unique secret of at least 32 characters');
  }
  return crypto.scryptSync(secret, 'soq-libya-identity-v1', 32);
}

function encryptIdentity(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('Identity image must be a non-empty string');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptIdentity(value) {
  if (typeof value !== 'string' || !value) return null;
  // Legacy plaintext rows remain readable during migration; new submissions are always encrypted.
  if (!value.startsWith(PREFIX)) return value;
  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted identity image');
  const [ivText, tagText, ciphertextText] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = { encryptIdentity, decryptIdentity, PREFIX };
