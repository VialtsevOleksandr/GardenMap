// Allows only positive integers (no decimals, no minus, no zero)
export function sanitizeInt(text) {
  const cleaned = text.replace(/[^0-9]/g, '');
  // Remove leading zeros (e.g. "007" → "7"), but allow single "0" while typing
  if (cleaned.length > 1 && cleaned[0] === '0') return cleaned.slice(1);
  return cleaned;
}

// Allows only positive decimals (dot or comma, no minus, no zero standalone)
export function sanitizeDecimal(text) {
  // Replace comma with dot, strip everything except digits and one dot
  let cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  // Keep only first dot
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  // Remove leading zeros before a non-dot character (e.g. "007" → "7"), but allow "0." (e.g. "0.5")
  if (cleaned.length > 1 && cleaned[0] === '0' && cleaned[1] !== '.') {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}
