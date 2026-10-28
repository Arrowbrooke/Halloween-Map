import { displayCategory } from './display-category.js';
import { findHome, homeKey, homeCenter } from './home-shapes.js';
import { pickStopName } from './stop-names.js';
import { lookupAddress } from './address-lookup.js';

const $ = (selector) => document.querySelector(selector);
const config = window.HALLOWEEN_CONFIG;
const demo = new URLSearchParams(location.search).get('demo') === '1';
const categories = {
  candy: { label: 'Kids’ candy', icon: '🍬', color: '#e97632' },
  adult: { label: 'Adult treats', icon: '🥤', color: '#a275df' },
  decor: { label: 'Decorations', icon: '👻', color: '#43ae87' }
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const demoStops = [
  { id: 'demo-1', title: 'The Pumpkin Porch', address: 'Sample stop · Gold Mine Trail', lat: 33.2473, lng: -96.9017, categories: ['candy'], notes: 'Sample home with candy for trick-or-treaters.' },
  { id: 'demo-2', title: 'Boo & Brews', address: 'Sample stop · Tomahawk Trail', lat: 33.2474, lng: -96.8973, categories: ['adult', 'candy'], notes: 'Sample home with treats for kids and grown-ups.' },
  { id: 'demo-3', title: 'The Haunted Garden', address: 'Sample stop · Pleasant Knoll Trail', lat: 33.2491, lng: -96.9027, categories: ['decor'], notes: 'Sample home with a spooky light show.' },
  { id: 'demo-4', title: 'Candy Corner', address: 'Sample stop · Starlight Avenue', lat: 33.246, lng: -96.9078, categories: ['candy', 'decor'], notes: 'Sample home with candy and decorations.' },
  { id: 'demo-5', title: 'The Witching Hour', address: 'Sample stop · Berry Ridge Trail', lat: 33.2502, lng: -96.9005, categories: ['adult'], notes: 'Sample grown-up treat stop.' }
];

let stops = [];
let selectedId = null;
let filter = new Set();
let db = null;
let currentUserId = null;
let chosenLocation = null;
let userMarker = null;
let searchMarker = null;
let searchTimer = null;
let searchRequest = 0;
let fogAnimationFrame = null;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}

function status(message, live = false) {
  $('#connection').textContent = message;
  $('#connection').classList.toggle('live', live);
}

const map = L.map('map', { zoomControl: false }).setView(config.center, config.zoom);
let tileWarning = false;
let streetMap = null;
const mapWarning = () => {
  if (tileWarning) return;
  tileWarning = true;
  toast('The street map could not load. Check your internet connection.');
};

try {
  const vectorTiles = L.maplibreGL({
    style: new URL('map-style.json', location.href).href,
    attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  streetMap = vectorTiles.getMaplibreMap();
  streetMap.on('error', mapWarning);
  streetMap.on('load', ensureMapEnhancements);
} catch {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'fallback-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map).on('tileerror', mapWarning);
}

function ensureMapEnhancements() {
  if (!streetMap || !streetMap.isStyleLoaded() || streetMap.getLayer('house-number-labels')) return;
  const firstSymbol = streetMap.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  streetMap.addLayer({
    id: 'house-number-labels',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'housenumber',
    minzoom: 16.75,
    layout: {
      'text-field': ['to-string', ['get', 'housenumber']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 19, 14],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-padding': 0
    },
    paint: {
      'text-color': '#fff4d8',
      'text-halo-color': '#181020',
      'text-halo-width': 1.8,
      'text-halo-blur': 0.2
    }
  }, firstSymbol);

  if (Array.isArray(config.focusBoundary) && config.focusBoundary.length > 2) {
    const boundary = config.focusBoundary.map(([lat, lng]) => [lng, lat]);
    boundary.push(boundary[0]);
    streetMap.addSource('arrowbrooke-focus', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
            boundary
          ]
        }
      }
    });

    const fogSize = 256;
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = fogSize;
    fogCanvas.height = fogSize;
    const fogContext = fogCanvas.getContext('2d');
    let fogSeed = 24681357;
    const fogRandom = () => {
      fogSeed = (fogSeed * 1664525 + 1013904223) >>> 0;
      return fogSeed / 4294967296;
    };
    for (let cloud = 0; cloud < 22; cloud += 1) {
      const x = fogRandom() * fogSize;
      const y = fogRandom() * fogSize;
      const radius = 24 + fogRandom() * 58;
      for (const offsetX of [-fogSize, 0, fogSize]) for (const offsetY of [-fogSize, 0, fogSize]) {
        const gradient = fogContext.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, radius);
        gradient.addColorStop(0, `rgba(248,252,255,${0.12 + fogRandom() * 0.14})`);
        gradient.addColorStop(0.5, 'rgba(241,248,252,0.09)');
        gradient.addColorStop(1, 'rgba(235,244,250,0)');
        fogContext.fillStyle = gradient;
        fogContext.fillRect(x + offsetX - radius, y + offsetY - radius, radius * 2, radius * 2);
      }
    }
    streetMap.addImage('arrowbrooke-fog-clouds', fogContext.getImageData(0, 0, fogSize, fogSize), { pixelRatio: 1 });
    streetMap.addLayer({
      id: 'outside-neighborhood-fog',
      type: 'fill',
      source: 'arrowbrooke-focus',
      paint: { 'fill-color': '#dce8ed', 'fill-opacity': 0.2 }
    });
    streetMap.addLayer({
      id: 'outside-neighborhood-fog-clouds',
      type: 'fill',
      source: 'arrowbrooke-focus',
      paint: {
        'fill-pattern': 'arrowbrooke-fog-clouds',
        'fill-opacity': 0.9,
        'fill-translate': [0, 0],
        'fill-translate-anchor': 'map'
      }
    });
    streetMap.addLayer({
      id: 'arrowbrooke-boundary-haze',
      type: 'line',
      source: 'arrowbrooke-focus',
      paint: { 'line-color': '#eef8fc', 'line-width': 20, 'line-blur': 12, 'line-opacity': 0.2 }
    });
    streetMap.addLayer({
      id: 'arrowbrooke-boundary',
      type: 'line',
      source: 'arrowbrooke-focus',
      paint: { 'line-color': '#d9f2fa', 'line-width': 1.4, 'line-blur': 0.8, 'line-opacity': 0.62 }
    });

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let fogLastFrame = 0;
      const animateFog = (time) => {
        if (time - fogLastFrame > 80 && streetMap?.getLayer('outside-neighborhood-fog-clouds')) {
          fogLastFrame = time;
          streetMap.setPaintProperty('outside-neighborhood-fog-clouds', 'fill-opacity', 0.82 + Math.sin(time / 2400) * 0.12);
        }
        fogAnimationFrame = requestAnimationFrame(animateFog);
      };
      if (fogAnimationFrame) cancelAnimationFrame(fogAnimationFrame);
      fogAnimationFrame = requestAnimationFrame(animateFog);
    }
  }
}

const markers = L.layerGroup().addTo(map);
const houseLayers = L.layerGroup().addTo(map);
const houseCache = new Map();
const homeRenderer = L.svg({ padding: 0.5 });
let shapeRefreshTimer;
let pinSequence = 0;

function scheduleHomes() {
  clearTimeout(shapeRefreshTimer);
  shapeRefreshTimer = setTimeout(drawMapStops, 100);
}
if (streetMap) {
  streetMap.on('idle', scheduleHomes);
  streetMap.on('sourcedata', (event) => { if (event.sourceId === 'openmaptiles') scheduleHomes(); });
}
map.on('moveend', scheduleHomes);

function mapDot(stop) {
  const color = categories[displayCategory(stop)].color;
  return L.divIcon({
    className: 'pin-shell', iconSize: [28, 28], iconAnchor: [14, 14],
    html: `<span class="overview-dot" style="background:${color}"></span>`
  });
}

function houseNumber(address) {
  const match = String(address ?? '').trim().match(/^(\d+[A-Za-z]?)(?:\s|$)/);
  return match ? match[1] : '';
}

function addHouseNumber(stop, position, abovePin = false) {
  const number = houseNumber(stop.address);
  if (!number || map.getZoom() < 18) return;
  const icon = L.divIcon({
    className: 'house-number-shell',
    iconSize: [46, 22],
    iconAnchor: [23, abovePin ? 58 : 11],
    html: `<span class="house-number">${escapeHtml(number)}</span>`
  });
  L.marker(position, { icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(markers);
}

function hideSearchResults() {
  $('#search-results').hidden = true;
  $('#search').setAttribute('aria-expanded', 'false');
}

function searchResultLabel(properties) {
  const street = properties.street || (properties.osm_key === 'highway' ? properties.name : '');
  const title = [properties.housenumber, street].filter(Boolean).join(' ') || properties.name || street;
  if (!title) return null;
  const place = [properties.city || properties.locality || properties.district, properties.state].filter(Boolean).join(', ');
  return { title, subtitle: place || (properties.housenumber ? 'Address' : 'Street') };
}

function insideFocusBoundary(lat, lng) {
  const polygon = config.focusBoundary;
  if (!Array.isArray(polygon) || polygon.length < 3) return inNeighborhood(lat, lng);
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [currentLat, currentLng] = polygon[current];
    const [previousLat, previousLng] = polygon[previous];
    if (((currentLng > lng) !== (previousLng > lng)) &&
      (lat < (previousLat - currentLat) * (lng - currentLng) / (previousLng - currentLng) + currentLat)) inside = !inside;
  }
  return inside;
}

function showSearchResults(results, message = '') {
  const panel = $('#search-results');
  if (message) panel.innerHTML = `<div class="search-result-status">${escapeHtml(message)}</div>`;
  else panel.innerHTML = results.map((result, index) => `<button class="search-result" role="option" data-result="${index}"><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.subtitle)}</small></button>`).join('');
  panel.hidden = false;
  $('#search').setAttribute('aria-expanded', 'true');
  panel._results = results;
}

async function searchAddresses(query) {
  const request = ++searchRequest;
  showSearchResults([], 'Searching ArrowBrooke addressesâ€¦');
  try {
    const url = new URL(config.addressSearchUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('lat', config.center[0]);
    url.searchParams.set('lon', config.center[1]);
    url.searchParams.set('bbox', '-96.909,33.240,-96.891,33.254');
    url.searchParams.set('limit', '12');
    url.searchParams.set('lang', 'en');
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
    if (!response.ok) throw new Error('Search unavailable');
    const data = await response.json();
    if (request !== searchRequest || $('#search').value.trim() !== query) return;
    const seen = new Set();
    const results = (data.features || []).map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const label = searchResultLabel(feature.properties || {});
      if (!label || !coordinates || !insideFocusBoundary(coordinates[1], coordinates[0])) return null;
      const key = label.title.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return { ...label, lat: coordinates[1], lng: coordinates[0], isHouse: Boolean(feature.properties?.housenumber) };
    }).filter(Boolean).slice(0, 8);
    showSearchResults(results, results.length ? '' : 'No matching ArrowBrooke address or street was found.');
  } catch {
    if (request === searchRequest) showSearchResults([], 'Address search is temporarily unavailable.');
  }
}

function selectSearchResult(result) {
  $('#search').value = result.title;
  hideSearchResults();
  closeDetail();
  render();
  if (searchMarker) searchMarker.remove();
  searchMarker = L.marker([result.lat, result.lng], {
    icon: L.divIcon({ className: 'search-location', iconSize: [20, 20], iconAnchor: [10, 10], html: '<span></span>' }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1200
  }).addTo(map);
  map.setView([result.lat, result.lng], result.isHouse ? 19 : 17);
  toast(result.isHouse ? 'Address found. Use Add my house to submit this location.' : 'Street found. Zoom in to choose a home.');
}

function pinIcon(stop) {
  const zoom = map.getZoom();
  const [width, height] = zoom <= 14 ? [11, 20] : zoom <= 15 ? [15, 27] : zoom <= 16 ? [20, 36] : [24, 43];
  const color = categories[displayCategory(stop)].color;
  const clipId = `coffin-pin-${++pinSequence}`;
  const outline = 'M7 1H19L25 11L20 33L13 43L6 33L1 11Z';
  const face = zoom >= 16 ? '<path d="m6 10 5 1-4 4zm14 0-5 1 4 4zM7 19l3 1 3-2 3 2 3-1-2 5H9Z" fill="#29182e"/>' : '';
  const svg = `<svg viewBox="0 0 26 44" aria-hidden="true"><defs><clipPath id="${clipId}"><path d="${outline}"/></clipPath></defs><rect width="26" height="44" fill="${color}" clip-path="url(#${clipId})"/><path d="${outline}" fill="none" stroke="#f5d5ae" stroke-opacity=".8" stroke-width="1.1"/>${face}</svg>`;
  return L.divIcon({
    className: 'pin-shell', iconSize: [36, 46], iconAnchor: [18, 46],
    html: `<div class="haunt-pin ${selectedId === stop.id ? 'selected' : ''}" style="--marker-width:${width}px;--marker-height:${height}px">${svg}</div>`
  });
}

function visibleStops() {
  const query = $('#search').value.trim().toLowerCase();
  return stops.filter((stop) =>
    (!filter.size || stop.categories.some((category) => filter.has(category))) &&
    `${stop.title} ${stop.address} ${stop.notes}`.toLowerCase().includes(query)
  );
}

function drawMapStops() {
  markers.clearLayers();
  houseLayers.clearLayers();
  const visible = visibleStops();
  const used = new Set();
  let buildings = [];
  if (streetMap && map.getZoom() >= 16) {
    try { buildings = streetMap.querySourceFeatures('openmaptiles', { sourceLayer: 'building' }); } catch { /* map still works with pins */ }
  }

  for (const stop of visible) {
    let home = houseCache.get(stop.id);
    if (!home && buildings.length) {
      home = findHome(buildings, stop.lng, stop.lat, demo ? 65 : 18, used);
      if (home) houseCache.set(stop.id, home);
    }
    if (home) used.add(homeKey(home));

    if (map.getZoom() < 17) {
      const position = home ? homeCenter(home) : [stop.lat, stop.lng];
      L.marker(position, { icon: mapDot(stop), title: stop.title, alt: stop.title }).addTo(markers).on('click', () => showDetail(stop.id));
      continue;
    }
    if (!home) {
      L.marker([stop.lat, stop.lng], { icon: pinIcon(stop), title: stop.title, alt: stop.title }).addTo(markers).on('click', () => showDetail(stop.id));
      addHouseNumber(stop, [stop.lat, stop.lng], true);
      continue;
    }

    const color = categories[displayCategory(stop)].color;
    const feature = { type: 'Feature', properties: {}, geometry: home };
    L.geoJSON(feature, { renderer: homeRenderer, interactive: false, style: { fill: false, color, weight: 7, opacity: 0.18, lineJoin: 'round' } }).addTo(houseLayers);
    const layer = L.geoJSON(feature, {
      renderer: homeRenderer,
      bubblingMouseEvents: false,
      style: { color, weight: selectedId === stop.id ? 2.5 : 1.3, opacity: 0.9, fillColor: color, fillOpacity: 0.78, className: 'haunted-home' }
    }).addTo(houseLayers);
    layer.eachLayer((shape) => {
      const path = shape.getElement();
      if (!path) return;
      path.setAttribute('data-stop-id', stop.id);
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.setAttribute('aria-label', stop.title);
      path.style.filter = `drop-shadow(0 0 3px ${color}88)`;
      path.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(stop.id); }
      });
      shape.on('click', () => showDetail(stop.id));
    });
    L.geoJSON(feature, { renderer: homeRenderer, bubblingMouseEvents: false, style: { color, weight: 14, opacity: 0, fillOpacity: 0, className: 'house-hit-area' } }).addTo(houseLayers).on('click', () => showDetail(stop.id));
    layer.bringToFront();
    addHouseNumber(stop, homeCenter(home));
  }
}

function render() {
  const visible = visibleStops();
  drawMapStops();
  $('#count').textContent = `${visible.length} stop${visible.length === 1 ? '' : 's'}`;
  $('#stop-list').innerHTML = visible.length ? visible.map((stop) => {
    const category = displayCategory(stop);
    const categoryInfo = categories[category];
    return `<button class="stop-row" data-stop="${escapeHtml(stop.id)}"><span class="stop-icon ${category}">${categoryInfo.icon}</span><span class="stop-text"><span class="stop-title">${escapeHtml(stop.title)}</span><span class="stop-address">${escapeHtml(stop.address)}</span><span class="stop-badge">${stop.categories.map((key) => categories[key].label).join(' · ')}</span></span></button>`;
  }).join('') : `<div class="empty"><span class="empty-icon">🎃</span><strong>${stops.length ? 'No matching stops' : 'Be the first on the block'}</strong>${stops.length ? 'Try another filter or search.' : 'Add your house to the neighborhood Halloween map.'}</div>`;
  $('#stop-list').querySelectorAll('[data-stop]').forEach((button) => { button.onclick = () => showDetail(button.dataset.stop); });
  if (selectedId && !visible.some((stop) => stop.id === selectedId)) closeDetail();
}

function closeDetail() {
  selectedId = null;
  $('#detail').hidden = true;
}

function showDetail(id, pan = true) {
  if (document.body.classList.contains('picking')) return;
  const stop = stops.find((item) => item.id === id);
  if (!stop) return;
  selectedId = id;
  drawMapStops();
  if (innerWidth <= 700) setSheet(false);
  $('#detail').innerHTML = `<button class="icon-button close-detail" aria-label="Close details">×</button><div class="eyebrow">${demo ? 'SAMPLE STOP · ' : ''}HALLOWEEN NIGHT</div><h2>${escapeHtml(stop.title)}</h2><div class="detail-tags">${stop.categories.map((key) => `<span class="tag">${categories[key].icon} ${categories[key].label}</span>`).join('')}</div><p>⌖ ${escapeHtml(stop.address)}</p>${stop.notes ? `<p>${escapeHtml(stop.notes)}</p>` : ''}<div class="detail-actions"><a class="secondary" href="https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=walking" target="_blank" rel="noopener noreferrer">↗ Directions</a><button class="primary" id="share-stop">Share stop</button></div>${db && stop.created_by === currentUserId ? '<button class="secondary" id="remove-stop" style="width:100%;margin-top:10px">Remove my house</button>' : ''}`;
  $('#detail').hidden = false;
  $('.close-detail').onclick = () => { closeDetail(); render(); };
  $('#share-stop').onclick = () => share(id);
  if ($('#remove-stop')) $('#remove-stop').onclick = async () => {
    if (!confirm('Remove your house from the neighborhood map?')) return;
    $('#remove-stop').disabled = true;
    const { error } = await db.from('stops').delete().eq('id', id);
    if (error) { toast('Could not remove the house. Please try again.'); $('#remove-stop').disabled = false; return; }
    closeDetail();
    await loadStops();
    toast('Your house was removed.');
  };
  if (pan) {
    map.setView(houseCache.has(id) ? homeCenter(houseCache.get(id)) : [stop.lat, stop.lng], Math.max(map.getZoom(), 17), { animate: false });
    map.panBy(innerWidth > 700 ? [-175, 0] : [0, 100], { animate: false });
  }
}

async function share(id) {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  if (demo) url.searchParams.set('demo', '1');
  if (id) url.searchParams.set('stop', id);
  try {
    if (navigator.share) await navigator.share({ title: 'ArrowBrooke After Dark', url: url.href });
    else { await navigator.clipboard.writeText(url.href); toast('Map link copied.'); }
  } catch (error) {
    if (error.name !== 'AbortError') toast('Copy the map link from your browser’s address bar to share it.');
  }
}

async function ensureVisitorSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session) {
    const result = await db.auth.signInAnonymously();
    if (result.error) throw result.error;
    session = result.data.session;
  }
  currentUserId = session.user.id;
  await db.realtime.setAuth(session.access_token);
}

function streetNearPin(lat, lng) {
  if (!streetMap) return null;
  try {
    const xScale = 111320 * Math.cos(lat * Math.PI / 180);
    const yScale = 111320;
    let best = null;
    let distance = 80;
    for (const feature of streetMap.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation_name' })) {
      const name = feature.properties?.['name:en'] || feature.properties?.name;
      if (!name) continue;
      const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : [];
      for (const line of lines) for (let index = 1; index < line.length; index += 1) {
        const a = [(line[index - 1][0] - lng) * xScale, (line[index - 1][1] - lat) * yScale];
        const b = [(line[index][0] - lng) * xScale, (line[index][1] - lat) * yScale];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const denominator = dx * dx + dy * dy;
        const ratio = denominator ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / denominator)) : 0;
        const currentDistance = Math.hypot(a[0] + ratio * dx, a[1] + ratio * dy);
        if (currentDistance < distance) { distance = currentDistance; best = { text: name, hasNumber: false }; }
      }
    }
    return best;
  } catch { return null; }
}

let addressRequest = 0;
let lastSuggestedAddress = '';
async function fillAddressFromPin(lat, lng) {
  const request = ++addressRequest;
  const input = document.querySelector('[name="address"]');
  const startingValue = input.value;
  if (startingValue.trim() && startingValue !== lastSuggestedAddress) { $('#address-help').textContent = 'Your entered address was kept. Check that it matches the new pin.'; return; }
  $('#address-help').textContent = 'Looking up this spot’s address…';
  try {
    let result;
    try { result = await lookupAddress(lat, lng, config.reverseGeocodeUrl); } catch { /* street fallback below */ }
    result = result || streetNearPin(lat, lng);
    if (request !== addressRequest || input.value !== startingValue) return;
    if (!result) { $('#address-help').textContent = 'No address found here. Please type the house number and street.'; return; }
    input.value = result.text;
    lastSuggestedAddress = result.text;
    $('#address-help').textContent = result.hasNumber ? 'Suggested address—please check the house number before saving.' : 'Street found—please add the house number before saving.';
  } catch {
    if (request === addressRequest) $('#address-help').textContent = 'Address lookup is unavailable. You can still type the address.';
  }
}

const dialog = $('#add-dialog');
function openAdd() { closeDetail(); $('#form-error').textContent = ''; dialog.showModal(); }
$('#add').onclick = openAdd;
$('#add-tab').onclick = openAdd;
$('.close-dialog').onclick = () => dialog.close();
$('#pick-location').onclick = () => {
  dialog.close();
  document.body.classList.add('picking');
  for (const id of ['place-hint', 'crosshair', 'confirm-location']) $(`#${id}`).hidden = false;
  if (chosenLocation) map.setView(chosenLocation, 18);
};
function endPicking() {
  document.body.classList.remove('picking');
  for (const id of ['place-hint', 'crosshair', 'confirm-location']) $(`#${id}`).hidden = true;
  dialog.showModal();
}
$('#confirm-location').onclick = () => {
  const point = map.getCenter();
  if (!inNeighborhood(point.lat, point.lng)) { toast('Please choose a spot in ArrowBrooke.'); return; }
  chosenLocation = [point.lat, point.lng];
  $('#location-label').textContent = '✓ Location selected. Tap above to adjust it.';
  endPicking();
  fillAddressFromPin(point.lat, point.lng);
};
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.body.classList.contains('picking')) endPicking(); });
function inNeighborhood(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33.23 && lat <= 33.27 && lng >= -96.925 && lng <= -96.88; }

$('#stop-form').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const errorElement = $('#form-error');
  errorElement.textContent = '';
  const selectedCategories = form.getAll('categories');
  if (!selectedCategories.length) { errorElement.textContent = 'Choose at least one kind of treat or decoration.'; return; }
  if (!chosenLocation) { errorElement.textContent = 'Choose your house location on the map first.'; return; }
  const title = form.get('title').trim() || pickStopName(stops.map((stop) => stop.title));
  const address = form.get('address').trim();
  if (!address) { errorElement.textContent = 'Enter the house number and street address.'; return; }
  if (address === lastSuggestedAddress && $('#address-help').textContent.startsWith('Street found')) { errorElement.textContent = 'Please add the house number to the suggested street address.'; return; }
  if (!db && !demo) { errorElement.textContent = 'The public map is not connected yet. The organizer needs to finish the one-time setup.'; return; }
  const stop = { title, address, categories: selectedCategories, notes: form.get('notes').trim(), lat: chosenLocation[0], lng: chosenLocation[1], event_date: config.eventDate };
  $('#save-stop').disabled = true;
  try {
    let id;
    if (demo) { id = crypto.randomUUID(); stops.push({ ...stop, id }); }
    else {
      await ensureVisitorSession();
      const { data, error } = await db.from('stops').insert(stop).select().single();
      if (error) throw error;
      id = data.id;
      await loadStops();
    }
    dialog.close();
    event.target.reset();
    chosenLocation = null;
    addressRequest += 1;
    lastSuggestedAddress = '';
    $('#address-help').textContent = 'Choose a spot on the map, or type the address yourself.';
    $('#location-label').textContent = 'Pick your house first; we’ll suggest its address.';
    filter.clear();
    $('#search').value = '';
    syncFilters();
    render();
    if (demo) showDetail(id);
    toast(demo ? 'Sample house added for this preview session.' : 'Submitted! Your house will appear after the organizer approves it.');
  } catch {
    errorElement.textContent = 'Could not save your house. Check your connection and try again.';
  } finally { $('#save-stop').disabled = false; }
};

function syncFilters() {
  document.querySelectorAll('[data-category]').forEach((button) => {
    const active = button.dataset.category === 'all' ? !filter.size : filter.has(button.dataset.category);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
$('.filters').onclick = (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  const category = button.dataset.category;
  if (category === 'all') filter.clear();
  else if (filter.has(category)) filter.delete(category);
  else filter.add(category);
  syncFilters();
  closeDetail();
  render();
};
$('#search').oninput = () => {
  closeDetail();
  render();
  clearTimeout(searchTimer);
  const query = $('#search').value.trim();
  if (query.length < 2 || !config.addressSearchUrl) { searchRequest += 1; hideSearchResults(); return; }
  searchTimer = setTimeout(() => searchAddresses(query), 300);
};
$('#search').onkeydown = (event) => {
  if (event.key === 'Escape') hideSearchResults();
  if (event.key === 'ArrowDown' && !$('#search-results').hidden) { event.preventDefault(); $('#search-results').querySelector('button')?.focus(); }
  if (event.key === 'Enter' && !$('#search-results').hidden) {
    const first = $('#search-results')._results?.[0];
    if (first) { event.preventDefault(); selectSearchResult(first); }
  }
};
$('#search-results').onclick = (event) => {
  const button = event.target.closest('[data-result]');
  if (button) selectSearchResult($('#search-results')._results[Number(button.dataset.result)]);
};
document.addEventListener('click', (event) => { if (!event.target.closest('.search-panel')) hideSearchResults(); });
$('#explore-tab').onclick = () => setSheet(true);
$('#home').onclick = () => map.setView(config.center, config.zoom);
$('#zoom-in').onclick = () => map.zoomIn();
$('#zoom-out').onclick = () => map.zoomOut();
$('#share').onclick = () => share();
$('#locate').onclick = () => {
  if (!navigator.geolocation) { toast('Your browser does not support location.'); return; }
  $('#locate').disabled = true;
  navigator.geolocation.getCurrentPosition((position) => {
    const latlng = [position.coords.latitude, position.coords.longitude];
    if (userMarker) userMarker.remove();
    userMarker = L.circleMarker(latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map).bindTooltip('You are here');
    map.setView(latlng, 17);
    $('#locate').disabled = false;
  }, () => {
    toast('Location is unavailable. You can still explore the map or use the home button.');
    $('#locate').disabled = false;
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
};

async function loadStops() {
  const { data, error } = await db.from('stops').select('*').eq('event_date', config.eventDate).eq('approval_status', 'approved').order('created_at');
  if (error) throw error;
  stops = data.filter((stop) => Array.isArray(stop.categories) && stop.categories.length && stop.categories.every((key) => categories[key]) && inNeighborhood(stop.lat, stop.lng));
  render();
  if (selectedId && stops.some((stop) => stop.id === selectedId)) showDetail(selectedId, false);
}

async function initialize() {
  if (demo) { stops = demoStops; status('Preview · Sample participating homes', true); render(); return; }
  if (!config.supabaseUrl || !config.supabaseKey) { status('Map setup in progress · Open the demo preview to explore the design.'); render(); return; }
  try {
    db = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
    db.auth.onAuthStateChange((event, session) => { if (session?.access_token) setTimeout(() => db.realtime.setAuth(session.access_token), 0); });
    await ensureVisitorSession();
    await loadStops();
    db.channel('halloween-stops').on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, () => loadStops().catch(() => status('Reconnecting · New homes may be delayed.'))).subscribe((state) => {
      if (state === 'SUBSCRIBED') { status('● Neighborhood map is live · New homes appear automatically.', true); loadStops().catch(() => status('Could not refresh homes. Check your connection.')); }
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) status('Reconnecting · New homes may be delayed.');
    });
    setInterval(() => loadStops().catch(() => status('Offline · Showing the last loaded homes.')), 30000);
    const requested = new URLSearchParams(location.search).get('stop');
    if (requested) showDetail(requested);
  } catch { status('Could not connect to the neighborhood map. Please try reloading.'); render(); }
}

map.on('zoomend', render);
initialize();

function setSheet(expanded) {
  document.body.classList.toggle('sheet-expanded', Boolean(expanded));
  document.body.classList.toggle('sheet-minimized', !expanded);
  $('#sheet-toggle').setAttribute('aria-expanded', String(Boolean(expanded)));
  $('#sheet-toggle').setAttribute('aria-label', expanded ? 'Minimize stop list' : 'Open stop list');
  document.querySelector('.explore').scrollTop = 0;
}
$('#sheet-toggle').onclick = () => setSheet(!document.body.classList.contains('sheet-expanded'));
