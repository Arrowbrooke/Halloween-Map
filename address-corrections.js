const removedAddressKeys = new Set([
  '891 PLEASANT KNOLL TRL',
  '903 WHITE WATER WAY',
  '602 ARROW BROOKE AVE',
  '603 ARROW BROOKE AVE',
  '797 ARROW BROOKE AVE',
  '1200 SARATOGA RD',
  '1233 ARROW BROOKE AVE',
  '1368 MORNING RIDGE TRL',
  '1442 PLEASANT KNOLL TRL',
  '1769 BLAKELY PL',
  '1904 ARROW BROOKE AVE'
]);

const addedAddresses = [
  {
    type: 'Feature',
    properties: { number: '1455', street: 'WHITE WATER WAY' },
    geometry: { type: 'Point', coordinates: [-96.9018221, 33.248491575] }
  },
  {
    type: 'Feature',
    properties: { number: '1501', street: 'BERRY RIDGE TRL' },
    geometry: { type: 'Point', coordinates: [-96.9016243, 33.2504157] }
  }
];

const addressKey = (feature) => {
  const number = String(feature.properties?.number || '').trim();
  const street = String(feature.properties?.street || '').trim().toUpperCase();
  return `${number} ${street}`.trim();
};

export function applyAddressCorrections(collection) {
  const features = (collection.features || []).filter((feature) => !removedAddressKeys.has(addressKey(feature)));
  const existing = new Set(features.map(addressKey));
  for (const feature of addedAddresses) {
    if (!existing.has(addressKey(feature))) features.push(structuredClone(feature));
  }
  return { ...collection, features };
}
