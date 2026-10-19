'use strict';

const MAX_IMAGE_DATA_URL_LENGTH = 5_000_000;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isAllowedImageDataUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_DATA_URL_LENGTH) return false;
  const match = IMAGE_DATA_URL_PATTERN.exec(value);
  if (!match) return false;
  const encoded = value.slice(value.indexOf(',') + 1);
  // Reject impossible base64 lengths and malformed padding before storing user input.
  if (!encoded || encoded.length % 4 !== 0) return false;
  try {
    return Buffer.from(encoded, 'base64').toString('base64') === encoded;
  } catch {
    return false;
  }
}

module.exports = { isAllowedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH };
