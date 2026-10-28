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
  frontierFogOffsetMeters: 18,
  fogEdgeWanderMeters: 4.5,
  eventDate: '2026-10-31'
};
