export function validateAvatar(type: string, bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > 2097152)
    throw new Error('Choose a JPEG, PNG, or WebP image under 2 MB.');
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const valid =
    (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    (type === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) ||
    (type === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP');
  if (!valid) throw new Error('The image contents must match JPEG, PNG, or WebP format.');
}
