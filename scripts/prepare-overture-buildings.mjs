import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2];
if (!input) throw new Error('Provide the downloaded Overture building GeoJSON path.');

const source = JSON.parse(await readFile(input, 'utf8'));
const output = {
  type: 'FeatureCollection',
  features: (source.features || [])
    .filter((feature) => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')
    .map((feature) => ({ type: 'Feature', properties: {}, geometry: feature.geometry }))
};

await writeFile(new URL('../arrowbrooke-buildings.geojson', import.meta.url), `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ sourceFeatures: source.features?.length || 0, outputFeatures: output.features.length }, null, 2));
