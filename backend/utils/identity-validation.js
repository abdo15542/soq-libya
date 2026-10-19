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
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.toString('base64') !== encoded) return false;
    // Check file signatures so arbitrary text with an image MIME type is rejected.
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    const mime = value.slice('data:image/'.length, value.indexOf(';'));
    return (mime === 'jpeg' && isJpeg) || (mime === 'png' && isPng) || (mime === 'webp' && isWebp);
  } catch {
    return false;
  }
}

module.exports = { isAllowedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH };
