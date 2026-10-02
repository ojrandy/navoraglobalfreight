// The four services offered on the Quote and Ship forms (docs/CONTENT.md §7.1, names and
// summaries from §3.1). `name` is the value stored with the quote or shipment.

export type ServiceOptionId = 'express' | 'freight' | 'vehicle' | 'vault';

export interface ServiceOption {
  id: ServiceOptionId;
  name: string;
  summary: string;
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: 'express',
    name: 'Priority Express Courier',
    summary: 'Our fastest door-to-door service for urgent documents and parcels, worldwide.',
  },
  {
    id: 'freight',
    name: 'Scheduled Freight & Linehaul',
    summary: 'Air, ocean and road freight on fixed departures, built for regular volumes and predictable transit.',
  },
  {
    id: 'vehicle',
    name: 'Vehicle Shipping & Transport',
    summary: 'International and domestic shipping for cars, motorcycles and fleet vehicles.',
  },
  {
    id: 'vault',
    name: 'Secure Vault & High-Value',
    summary: 'Sealed, tamper-evident transport with restricted hand-offs for valuables and sensitive cargo.',
  },
];

/** The option whose id or name matches `value` (case-insensitive), or the first option. */
export function findServiceOption(value?: string): ServiceOption {
  const v = (value || '').trim().toLowerCase();
  return SERVICE_OPTIONS.find((s) => s.id === v || s.name.toLowerCase() === v) || SERVICE_OPTIONS[0];
}
