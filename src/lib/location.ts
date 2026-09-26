import { z } from 'zod';

export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
  GU: 'Guam',
  AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
};
export const locationSchema = z.object({
  id: z.string().min(1).max(512),
  provider: z.enum(['geoapify', 'demo']),
  city: z.string().trim().min(1).max(100),
  state_code: z.string().refine((value) => Object.hasOwn(US_STATES, value), 'Choose a US state.'),
  country_code: z.literal('US'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Location = z.infer<typeof locationSchema>;
export type LocationOption = { location: Location; token: string };
export const locationSelection = {
  location_id: z.string().trim().min(1, 'Select a city from the suggestions.').max(512),
  location_token: z.string().max(4096).default(''),
};
export const CAUSES = [
  'Food access',
  'Education',
  'Environment',
  'Health',
  'Housing',
  'Community support',
] as const;
export const interestsSchema = z.array(z.enum(CAUSES)).max(CAUSES.length).default([]);
export function locationLabel(location: Location) {
  return `${location.city}, ${US_STATES[location.state_code]}, United States`;
}
export function shortLocation(record: { city: string; location?: Location | null }) {
  return record.location ? `${record.location.city}, ${record.location.state_code}` : record.city;
}
export function sameCity(a?: Location | null, b?: Location | null) {
  return Boolean(
    a &&
    b &&
    a.country_code === b.country_code &&
    a.state_code === b.state_code &&
    a.city.trim().toLowerCase() === b.city.trim().toLowerCase(),
  );
}

// Fixed examples for the browser-only demo; live mode never falls back to these.
export const DEMO_LOCATIONS: Location[] = [
  {
    id: 'demo:williamsburg-va',
    provider: 'demo',
    city: 'Williamsburg',
    state_code: 'VA',
    country_code: 'US',
    latitude: 37.2707,
    longitude: -76.7075,
  },
  {
    id: 'demo:williamsburg-ky',
    provider: 'demo',
    city: 'Williamsburg',
    state_code: 'KY',
    country_code: 'US',
    latitude: 36.7434,
    longitude: -84.1597,
  },
  {
    id: 'demo:richmond-va',
    provider: 'demo',
    city: 'Richmond',
    state_code: 'VA',
    country_code: 'US',
    latitude: 37.5407,
    longitude: -77.436,
  },
];
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}
export function demoLocations(query: string) {
  const text = query.trim().toLowerCase();
  return DEMO_LOCATIONS.filter(
    (place) =>
      locationLabel(place).toLowerCase().includes(text) ||
      shortLocation({ city: place.city, location: place }).toLowerCase().includes(text) ||
      (text.length >= 5 && distance(text, place.city.toLowerCase()) <= 3),
  );
}
export function demoLocation(id: string) {
  const location = DEMO_LOCATIONS.find((place) => place.id === id);
  if (!location) throw new Error('Select a city from the suggestions.');
  return structuredClone(location);
}
