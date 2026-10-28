import { readFile, writeFile } from 'node:fs/promises';

const buildingPath = new URL('../arrowbrooke-buildings.geojson', import.meta.url);
const addressPath = new URL('../arrowbrooke-addresses.geojson', import.meta.url);
const buildings = JSON.parse(await readFile(buildingPath, 'utf8'));
const addresses = JSON.parse(await readFile(addressPath, 'utf8'));
const targetStreets = new Set([
  'AURORA LN', 'CLEAR FORK ST', 'EDGEMIRE LN', 'GREAT PLAINS DR',
  'HUTTON BRANCH CT', 'HUTTON BRANCH TRL', 'LAUREL AVE', 'MIDNIGHT LN',
  'MISSION ST', 'SOAPBERRY DR', 'SOAPBERRY ST'
]);

const candidates = (addresses.features || []).filter((feature) =>
  feature.properties?.building_match_m == null && targetStreets.has(feature.properties?.street)
);
const byStreet = new Map();
for (const feature of candidates) {
  const street = feature.properties.street;
  if (!byStreet.has(street)) byStreet.set(street, []);
  byStreet.get(street).push(feature);
}

function metersBetween(a, b) {
  const meanLat = (a[1] + b[1]) / 2;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(meanLat * Math.PI / 180),
    (a[1] - b[1]) * 111320
  );
}

function estimatedFootprint(feature) {
  const center = feature.geometry.coordinates;
  const neighbors = (byStreet.get(feature.properties.street) || [])
    .filter((other) => other !== feature)
    .map((other) => ({ point: other.geometry.coordinates, distance: metersBetween(center, other.geometry.coordinates) }))
    .filter(({ distance }) => distance < 75)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);
  let east = 1;
  let north = 0;
  if (neighbors.length) {
    const first = neighbors[0].point;
    const second = neighbors[1]?.point;
    const start = second || center;
    const end = second ? first : first;
    const meanLat = (start[1] + end[1]) / 2;
    east = (end[0] - start[0]) * Math.cos(meanLat * Math.PI / 180);
    north = end[1] - start[1];
    const length = Math.hypot(east, north) || 1;
    east /= length;
    north /= length;
  }
  const normalEast = -north;
  const normalNorth = east;
  const halfWidth = 7.2;
  const halfDepth = 9.5;
  const longitudeMeters = 111320 * Math.cos(center[1] * Math.PI / 180);
  const corner = (along, across) => [
    center[0] + (east * along + normalEast * across) / longitudeMeters,
    center[1] + (north * along + normalNorth * across) / 111320
  ];
  const ring = [
    corner(-halfWidth, -halfDepth), corner(halfWidth, -halfDepth),
    corner(halfWidth, halfDepth), corner(-halfWidth, halfDepth)
  ];
  ring.push(ring[0]);
  return {
    type: 'Feature',
    properties: { estimated: true },
    geometry: { type: 'Polygon', coordinates: [ring] }
  };
}

buildings.features = buildings.features.filter((feature) => !feature.properties?.estimated);
const estimates = candidates.map(estimatedFootprint);
buildings.features.push(...estimates);
await writeFile(buildingPath, `${JSON.stringify(buildings)}\n`);
console.log(JSON.stringify({ overtureFootprints: buildings.features.length - estimates.length, estimatedFootprints: estimates.length, total: buildings.features.length }, null, 2));
