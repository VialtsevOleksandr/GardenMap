import rules from '../data/rotation_rules.json';

export function getRotationAdvice(cropHistory) {
  if (!cropHistory || cropHistory.length === 0) {
    return { status: 'ok', reasonKey: 'rotation.noHistory' };
  }

  const lastCrop = cropHistory[cropHistory.length - 1];
  const cropRules = rules[lastCrop];

  if (!cropRules) {
    return { status: 'ok', reasonKey: 'rotation.noRules', reasonParams: { crop: lastCrop } };
  }

  const prevCrop = cropHistory.length > 1 ? cropHistory[cropHistory.length - 2] : null;

  // No previous crop = first planting on this bed, rotation can't be evaluated
  if (!prevCrop) {
    return { status: 'ok', reasonKey: 'rotation.noHistory' };
  }

  // Check if current crop grows badly after the PREVIOUS crop
  if (cropRules.badAfter?.includes(prevCrop)) {
    return { status: 'bad', reasonKey: 'rotation.badAfterCrop', reasonParams: { crop: lastCrop, prev: prevCrop } };
  }

  // Check if current crop grows well after the previous crop
  if (cropRules.goodAfter?.includes(prevCrop)) {
    return { status: 'good', reasonKey: 'rotation.goodAfter', reasonParams: { crop: lastCrop, prev: prevCrop } };
  }

  return { status: 'ok', reasonKey: 'rotation.acceptable' };
}

// Returns crops recommended/avoided for the NEXT planting based on what grew last
export function getNextCropSuggestions(cropHistory) {
  const history = (cropHistory || []).filter(Boolean);
  if (history.length === 0) return { recommended: [], avoid: [], lastCrop: null };

  const lastCrop = history[history.length - 1];
  const recommended = [];
  const avoid = [];

  Object.entries(rules).forEach(([cropName, cropRules]) => {
    if (cropRules.goodAfter?.includes(lastCrop)) recommended.push(cropName);
    if (cropRules.badAfter?.includes(lastCrop)) avoid.push(cropName);
  });

  return { recommended, avoid, lastCrop };
}
