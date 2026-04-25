import catalog from '../data/plants_catalog.json';
import i18n from '../i18n';

export function getCatalogPlants() {
  return catalog.map(p => ({
    ...p,
    name: i18n.t(`plantName.${p.id}`),
  }));
}

export function findCatalogPlant(id) {
  return catalog.find(p => p.id === id) ?? null;
}

// Build a lookup map: plantId → { badAfter[], goodAfter[] }
const rulesMap = {};
catalog.forEach(p => { rulesMap[p.id] = { badAfter: p.badAfter, goodAfter: p.goodAfter }; });
export { rulesMap };
