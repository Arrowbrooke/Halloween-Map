const removedAddressKeys = new Set([
  '891 PLEASANT KNOLL TRL',
  '903 WHITE WATER WAY'
]);

const addedAddresses = [
  {
    type: 'Feature',
    properties: { number: '1455', street: 'WHITE WATER WAY' },
    geometry: { type: 'Point', coordinates: [-96.9018221, 33.248491575] }
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
