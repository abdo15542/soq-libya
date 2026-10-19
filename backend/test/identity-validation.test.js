'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH } = require('../utils/identity-validation');

test('accepts supported image data URLs with valid base64', () => {
  for (const mime of ['jpeg', 'png', 'webp']) {
    assert.equal(isAllowedImageDataUrl(`data:image/${mime};base64,aGVsbG8=`), true);
  }
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
