window.HALLOWEEN_CONFIG = {
  // Add the public URL and publishable key from this site's own Supabase project.
  // Never use a service_role or secret key here.
  supabaseUrl: '',
  supabaseKey: '',
  reverseGeocodeUrl: 'https://photon.komoot.io/reverse',
  addressSearchUrl: 'https://photon.komoot.io/api/',
  center: [33.2475, -96.9025],
  zoom: 16,
  // Simplified focus area traced from the organizer's preferred squared boundary.
  focusBoundary: [
    [33.25195, -96.90995],
    [33.25195, -96.89415],
    [33.23910, -96.89415],
    [33.24025, -96.90995]
  ],
  // Approximate centerline of Frontier Parkway from west to east. The fog edge
  // is generated from this alignment, then moved north by the offset below.
  frontierAlignment: [
    [33.25170, -96.90995],
    [33.25167, -96.90710],
    [33.25153, -96.90310],
    [33.25139, -96.89925],
    [33.25122, -96.89645],
    [33.25108, -96.89415]
  ],
  fm1385Alignment: [
    [33.25108, -96.89415],
    [33.24875, -96.89424],
    [33.24615, -96.89429],
    [33.24355, -96.89425],
    [33.24115, -96.89419],
    [33.23910, -96.89415]
  ],
  southernAlignment: [
    [33.23910, -96.89415],
    [33.23916, -96.89715],
    [33.23930, -96.90010],
    [33.23956, -96.90315],
    [33.23991, -96.90630],
    [33.24025, -96.90995]
  ],
  winnRidgeAlignment: [
    [33.24025, -96.90995],
    [33.24255, -96.90988],
    [33.24505, -96.90976],
    [33.24765, -96.90967],
    [33.25005, -96.90973],
    [33.25170, -96.90995]
  ],
  fogRoadOffsetMeters: 18,
  fogEdgeWanderMeters: 4.5,
  eventDate: '2026-10-31'
};
