// Global gateway network (docs/CONTENT.md §9). These are gateways the network serves,
// not company-owned facilities. The list is pending the owner's confirmation.

export type TransportMode = 'Air' | 'Ocean' | 'Road';

export type GatewayRegion = 'Africa' | 'Europe' | 'Middle East' | 'Asia' | 'Americas' | 'Oceania';

export interface Gateway {
  code: string;
  name: string;
  city: string;
  country: string;
  iso: string;
  lat: number;
  lng: number;
  timeZone: string;
  modes: TransportMode[];
  region: GatewayRegion;
}

export const GATEWAYS: Gateway[] = [
  { code: 'LOS', name: 'Lagos', city: 'Lagos', country: 'Nigeria', iso: 'NG', lat: 6.5774, lng: 3.3212, timeZone: 'Africa/Lagos', modes: ['Air', 'Ocean', 'Road'], region: 'Africa' },
  { code: 'ACC', name: 'Accra', city: 'Accra', country: 'Ghana', iso: 'GH', lat: 5.6052, lng: -0.1668, timeZone: 'Africa/Accra', modes: ['Air', 'Road'], region: 'Africa' },
  { code: 'NBO', name: 'Nairobi', city: 'Nairobi', country: 'Kenya', iso: 'KE', lat: -1.3192, lng: 36.9278, timeZone: 'Africa/Nairobi', modes: ['Air', 'Road'], region: 'Africa' },
  { code: 'JNB', name: 'Johannesburg', city: 'Johannesburg', country: 'South Africa', iso: 'ZA', lat: -26.1392, lng: 28.2460, timeZone: 'Africa/Johannesburg', modes: ['Air', 'Road'], region: 'Africa' },
  { code: 'LHR', name: 'London', city: 'London', country: 'United Kingdom', iso: 'GB', lat: 51.4700, lng: -0.4543, timeZone: 'Europe/London', modes: ['Air', 'Road'], region: 'Europe' },
  { code: 'RTM', name: 'Rotterdam', city: 'Rotterdam', country: 'Netherlands', iso: 'NL', lat: 51.9496, lng: 4.1453, timeZone: 'Europe/Amsterdam', modes: ['Ocean', 'Road'], region: 'Europe' },
  { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany', iso: 'DE', lat: 50.0379, lng: 8.5622, timeZone: 'Europe/Berlin', modes: ['Air', 'Road'], region: 'Europe' },
  { code: 'DXB', name: 'Dubai', city: 'Dubai', country: 'United Arab Emirates', iso: 'AE', lat: 25.2532, lng: 55.3657, timeZone: 'Asia/Dubai', modes: ['Air', 'Ocean'], region: 'Middle East' },
  { code: 'BOM', name: 'Mumbai', city: 'Mumbai', country: 'India', iso: 'IN', lat: 19.0896, lng: 72.8656, timeZone: 'Asia/Kolkata', modes: ['Air', 'Ocean'], region: 'Asia' },
  { code: 'SIN', name: 'Singapore', city: 'Singapore', country: 'Singapore', iso: 'SG', lat: 1.3644, lng: 103.9915, timeZone: 'Asia/Singapore', modes: ['Air', 'Ocean'], region: 'Asia' },
  { code: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'Hong Kong SAR', iso: 'HK', lat: 22.3080, lng: 113.9185, timeZone: 'Asia/Hong_Kong', modes: ['Air', 'Ocean'], region: 'Asia' },
  { code: 'PVG', name: 'Shanghai', city: 'Shanghai', country: 'China', iso: 'CN', lat: 31.1443, lng: 121.8083, timeZone: 'Asia/Shanghai', modes: ['Air', 'Ocean'], region: 'Asia' },
  { code: 'JFK', name: 'New York', city: 'New York', country: 'United States', iso: 'US', lat: 40.6413, lng: -73.7781, timeZone: 'America/New_York', modes: ['Air', 'Road'], region: 'Americas' },
  { code: 'IAH', name: 'Houston', city: 'Houston', country: 'United States', iso: 'US', lat: 29.9902, lng: -95.3368, timeZone: 'America/Chicago', modes: ['Air', 'Ocean', 'Road'], region: 'Americas' },
  { code: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'United States', iso: 'US', lat: 33.9416, lng: -118.4085, timeZone: 'America/Los_Angeles', modes: ['Air', 'Ocean', 'Road'], region: 'Americas' },
  { code: 'YYZ', name: 'Toronto', city: 'Toronto', country: 'Canada', iso: 'CA', lat: 43.6777, lng: -79.6248, timeZone: 'America/Toronto', modes: ['Air', 'Road'], region: 'Americas' },
  { code: 'GRU', name: 'São Paulo', city: 'São Paulo', country: 'Brazil', iso: 'BR', lat: -23.4356, lng: -46.4731, timeZone: 'America/Sao_Paulo', modes: ['Air', 'Ocean'], region: 'Americas' },
  { code: 'SYD', name: 'Sydney', city: 'Sydney', country: 'Australia', iso: 'AU', lat: -33.9399, lng: 151.1753, timeZone: 'Australia/Sydney', modes: ['Air', 'Ocean'], region: 'Oceania' },
];

// Scheduled trade lanes, drawn as great-circle arcs (CONTENT.md §9).
export const TRADE_LANES: [string, string][] = [
  ['LOS', 'LHR'], ['LOS', 'DXB'], ['LOS', 'JFK'], ['LHR', 'JFK'], ['DXB', 'SIN'],
  ['SIN', 'SYD'], ['PVG', 'RTM'], ['HKG', 'LAX'], ['FRA', 'DXB'], ['JNB', 'DXB'],
  ['NBO', 'LHR'], ['GRU', 'JFK'], ['IAH', 'RTM'], ['YYZ', 'LHR'], ['BOM', 'DXB'],
];

export function getGateway(code: string): Gateway | undefined {
  return GATEWAYS.find((g) => g.code === code);
}

// Codes of every gateway with a direct lane to `code`.
export function getLanePartners(code: string): string[] {
  return TRADE_LANES.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []));
}

// Local wall-clock time at a gateway, e.g. { time: '14:05', offset: 'GMT+1' }.
export function formatGatewayTime(timeZone: string, now: Date = new Date()): { time: string; offset: string } {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  let offset = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' } as Intl.DateTimeFormatOptions).formatToParts(now);
    offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    // Older engines without 'shortOffset' just omit the offset.
  }
  return { time, offset };
}
