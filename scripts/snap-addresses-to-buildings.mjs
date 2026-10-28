import { readFile, writeFile } from 'node:fs/promises';
import { distanceToHome, homeCenter } from '../home-shapes.js';

const addressPath = new URL('../arrowbrooke-addresses.geojson', import.meta.url);
const buildingArgument = process.argv.indexOf('--buildings');
const buildingPath = buildingArgument >= 0 && process.argv[buildingArgument + 1]
  ? process.argv[buildingArgument + 1]
  : new URL('../arrowbrooke-buildings.geojson', import.meta.url);
const addresses = JSON.parse(await readFile(addressPath, 'utf8'));
const buildings = JSON.parse(await readFile(buildingPath, 'utf8'));
const writeChanges = process.argv.includes('--write');
const maxDistance = 34;
const cellSize = 0.00045;

const parts = [];
for (const feature of buildings.features || []) {
  const geometry = feature.geometry;
  if (geometry?.type === 'Polygon') parts.push(geometry);
  if (geometry?.type === 'MultiPolygon') {
    for (const coordinates of geometry.coordinates) parts.push({ type: 'Polygon', coordinates });
  }
}

const grid = new Map();
const cellKey = (lng, lat) => `${Math.floor(lng / cellSize)},${Math.floor(lat / cellSize)}`;
for (let index = 0; index < parts.length; index += 1) {
  const [lat, lng] = homeCenter(parts[index]);
  const key = cellKey(lng, lat);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(index);
}

const pairs = [];
for (let addressIndex = 0; addressIndex < addresses.features.length; addressIndex += 1) {
  const feature = addresses.features[addressIndex];
  const [lng, lat] = feature.geometry.coordinates;
  const cellX = Math.floor(lng / cellSize);
  const cellY = Math.floor(lat / cellSize);
  const candidates = new Set();
  for (let x = cellX - 1; x <= cellX + 1; x += 1) {
    for (let y = cellY - 1; y <= cellY + 1; y += 1) {
      for (const buildingIndex of grid.get(`${x},${y}`) || []) candidates.add(buildingIndex);
    }
  }
  for (const buildingIndex of candidates) {
    const distance = distanceToHome(parts[buildingIndex], lng, lat);
    if (distance <= maxDistance) pairs.push({ addressIndex, buildingIndex, distance });
  }
}

pairs.sort((a, b) => a.distance - b.distance);
const usedAddresses = new Set();
const usedBuildings = new Set();
const matches = [];
for (const pair of pairs) {
  if (usedAddresses.has(pair.addressIndex) || usedBuildings.has(pair.buildingIndex)) continue;
  usedAddresses.add(pair.addressIndex);
  usedBuildings.add(pair.buildingIndex);
  matches.push(pair);
}

let moved = 0;
for (const { addressIndex, buildingIndex, distance } of matches) {
  const feature = addresses.features[addressIndex];
  const [lat, lng] = homeCenter(parts[buildingIndex]);
  const [oldLng, oldLat] = feature.geometry.coordinates;
  const movement = Math.hypot((lng - oldLng) * 111320 * Math.cos(lat * Math.PI / 180), (lat - oldLat) * 111320);
  if (movement > 0.75) moved += 1;
  feature.geometry.coordinates = [lng, lat];
  feature.properties.building_match_m = Math.round(distance * 10) / 10;
}

const unmatched = addresses.features
  .map((feature, index) => ({ feature, index }))
  .filter(({ index }) => !usedAddresses.has(index));
const report = {
  addresses: addresses.features.length,
  buildingShapes: parts.length,
  buildingCentersOutsideShape: parts.filter((geometry) => {
    const [lat, lng] = homeCenter(geometry);
    return distanceToHome(geometry, lng, lat) > 0.05;
  }).length,
  matched: matches.length,
  moved,
  unmatched: unmatched.length,
  maxMatchDistanceMeters: Math.max(0, ...matches.map(({ distance }) => distance)).toFixed(1),
  unmatchedExamples: unmatched.slice(0, 12).map(({ feature }) => `${feature.properties.number} ${feature.properties.street}`)
};

if (writeChanges) {
  await writeFile(addressPath, `${JSON.stringify(addresses)}\n`);
}
console.log(JSON.stringify(report, null, 2));
