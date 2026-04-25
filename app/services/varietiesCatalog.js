// Returns the localized variety display string for any plant or crop document.
// Community plants/crops have varietyId; personal ones have plain text variety.
export function resolveVariety(item, t) {
  if (item.varietyId) return t(`varietyName.${item.varietyId}`);
  return item.variety || '';
}
