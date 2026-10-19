'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH } = require('../utils/identity-validation');

test('accepts supported image data URLs with valid base64', () => {
  const samples = [
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['webp', Buffer.from('RIFF0000WEBP')]
  ];
  for (const [mime, bytes] of samples) {
    assert.equal(isAllowedImageDataUrl(`data:image/${mime};base64,${bytes.toString('base64')}`), true);
  }
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,aGVsbG8='), false);
});

test('rejects non-image, unsupported MIME, and malformed payloads', () => {
  assert.equal(isAllowedImageDataUrl('data:text/plain;base64,aGVsbG8='), false);
  assert.equal(isAllowedImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,%%%='), false);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,aGVsbG8'), false);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,'), false);
  assert.equal(isAllowedImageDataUrl(null), false);
  assert.equal(isAllowedImageDataUrl({}), false);
});

test('rejects oversized payloads', () => {
  assert.equal(isAllowedImageDataUrl(`data:image/png;base64,${'A'.repeat(MAX_IMAGE_DATA_URL_LENGTH)}`), false);
});
