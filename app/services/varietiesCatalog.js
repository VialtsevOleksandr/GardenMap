// Returns the localized variety display string for any plant or crop document.
// Community plants/crops have varietyId; personal ones have plain text variety.
export function resolveVariety(item, t) {
  if (!item) return '';
  if (item.varietyId) return t(`varietyName.${item.varietyId}`);
  return item.variety || '';
}

// Returns the localized plant name. Catalog plants are resolved via plantId key;
// custom plants fall back to the stored name string.
export function resolveName(item, t) {
  if (!item) return '';
  if (item.plantId) {
    const key = `plantName.${item.plantId}`;
    const translated = t(key);
    // If i18next returns the key itself, the translation is missing — fall back to stored name
    return translated !== key ? translated : (item.name || '');
  }
  return item.name || '';
}
