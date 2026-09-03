const PREFIX_LIMIT = 8_192;

export function isLikelyBinary(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.byteLength, PREFIX_LIMIT);
  if (limit === 0) {
    return false;
  }
  let suspicious = 0;
  for (let index = 0; index < limit; index += 1) {
    const value = bytes[index]!;
    if (value === 0) {
      return true;
    }
    if (value < 7 || (value > 13 && value < 32)) {
      suspicious += 1;
    }
  }
  return suspicious / limit > 0.1;
}
