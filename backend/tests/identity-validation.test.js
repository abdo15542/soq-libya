const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH } = require('../utils/identity-validation');

test('accepts JPEG, PNG, and WebP data URLs with matching signatures', () => {
  assert.equal(isAllowedImageDataUrl('data:image/jpeg;base64,/9j/AA=='), true);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,iVBORw0KGgo='), true);
  // RIFF + four-byte size + WEBP signature; the validator checks the container signature.
  assert.equal(isAllowedImageDataUrl('data:image/webp;base64,UklGRgQAAABXRUJQ'), true);
});

test('rejects unsupported MIME types and MIME/signature mismatches', () => {
  assert.equal(isAllowedImageDataUrl('data:image/gif;base64,R0lGODlh'), false);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,/9j/AA=='), false);
  assert.equal(isAllowedImageDataUrl('data:text/plain;base64,SGVsbG8='), false);
});

test('rejects malformed base64 and oversized data URLs', () => {
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,%%%='), false);
  assert.equal(isAllowedImageDataUrl('data:image/png;base64,abc'), false);
  assert.equal(isAllowedImageDataUrl('x'.repeat(MAX_IMAGE_DATA_URL_LENGTH + 1)), false);
  assert.equal(isAllowedImageDataUrl(null), false);
});
