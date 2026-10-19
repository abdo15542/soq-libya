const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = 'test-only-identity-key-0123456789-abcdef';
const { encryptIdentity, decryptIdentity, PREFIX } = require('../utils/identity-crypto');

test('identity image is encrypted and round-trips correctly', () => {
  const image = 'data:image/png;base64,AAECAwQ=';
  const encrypted = encryptIdentity(image);
  assert.ok(encrypted.startsWith(PREFIX));
  assert.notEqual(encrypted, image);
  assert.equal(decryptIdentity(encrypted), image);
});

test('identity ciphertext uses a fresh nonce each time', () => {
  const image = 'data:image/jpeg;base64,AAECAwQ=';
  assert.notEqual(encryptIdentity(image), encryptIdentity(image));
});

test('legacy plaintext records remain readable during migration', () => {
  const image = 'data:image/webp;base64,AAECAwQ=';
  assert.equal(decryptIdentity(image), image);
});

test('tampered ciphertext is rejected', () => {
  const encrypted = encryptIdentity('data:image/png;base64,AAECAwQ=');
  const tampered = encrypted.slice(0, -2) + 'xx';
  assert.throws(() => decryptIdentity(tampered));
});
