import { rulesMap } from './plantsCatalog';

// cropIdHistory: string[] — array of plantId values from oldest to newest
export function getRotationAdvice(cropIdHistory) {
  const history = (cropIdHistory || []).filter(Boolean);

  if (history.length === 0) {
    return { status: 'ok', reasonKey: 'rotation.noHistory' };
  }

  const lastId  = history[history.length - 1];
  const prevId  = history.length > 1 ? history[history.length - 2] : null;
  const cropRules = rulesMap[lastId];

  if (!cropRules) {
    return { status: 'ok', reasonKey: 'rotation.noRules', reasonParams: { crop: lastId } };
  }

  if (!prevId) {
    return { status: 'ok', reasonKey: 'rotation.noHistory' };
  }

  if (cropRules.badAfter?.includes(prevId)) {
    return {
      status: 'bad',
      reasonKey: 'rotation.badAfterCrop',
      reasonParams: { cropKey: `plantName.${lastId}`, prevKey: `plantName.${prevId}` },
    };
  }

  if (cropRules.goodAfter?.includes(prevId)) {
    return {
      status: 'good',
      reasonKey: 'rotation.goodAfter',
      reasonParams: { cropKey: `plantName.${lastId}`, prevKey: `plantName.${prevId}` },
    };
  }

  return { status: 'ok', reasonKey: 'rotation.acceptable' };
}

// Returns recommended/avoided plantIds for the NEXT planting based on what grew last
export function getNextCropSuggestions(cropIdHistory) {
  const history = (cropIdHistory || []).filter(Boolean);
  if (history.length === 0) return { recommended: [], avoid: [], lastCropId: null };

  const lastId = history[history.length - 1];
  const recommended = [];
  const avoid = [];

  Object.entries(rulesMap).forEach(([id, rules]) => {
    if (rules.goodAfter?.includes(lastId)) recommended.push(id);
    if (rules.badAfter?.includes(lastId)) avoid.push(id);
  });

  return { recommended, avoid, lastCropId: lastId };
}
