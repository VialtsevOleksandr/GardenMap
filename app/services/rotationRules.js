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

  if (cropRules.badAfter && cropRules.badAfter.includes(lastCrop)) {
    return { status: 'bad', reasonKey: 'rotation.badSameCrop', reasonParams: { crop: lastCrop } };
  }

  if (prevCrop && cropRules.goodAfter && cropRules.goodAfter.includes(prevCrop)) {
    return { status: 'good', reasonKey: 'rotation.goodAfter', reasonParams: { crop: lastCrop, prev: prevCrop } };
  }

  return { status: 'ok', reasonKey: 'rotation.acceptable' };
}
