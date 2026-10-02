// Legal pages (docs/CONTENT.md §13): plain-language drafts.
// LAWYER REVIEW REQUIRED BEFORE LAUNCH (tracker 3.11, Blocked #11). Items marked [confirm] in
// CONTENT §13 are shown as written until the owner confirms them.

import { COMPANY_SHORT, DOMAIN, LEGAL_NAME } from '../config/brand';

export type LegalDocId = 'privacy' | 'terms' | 'shipping-terms' | 'cookies' | 'accessibility';

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | string[];

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  id: LegalDocId;
  /** Tab and footer label */
  label: string;
  title: string;
  sections: LegalSection[];
}

/** Shown on every legal page. Update it whenever the text below changes. */
export const LEGAL_LAST_UPDATED = '29 September 2026';

// TODO(owner + lawyer): {{JURISDICTION}} — the country where the company (LEGAL_NAME) is
// registered. Until it is known the governing-law clause below names no country (nothing is
// shown in its place); replace GOVERNING_LAW with the named jurisdiction once confirmed.
const GOVERNING_LAW = `These terms are governed by the laws of the country in which ${LEGAL_NAME} is registered. Nothing in them takes away rights you have under the consumer law of the country where you live.`;

interface LegalContact {
  email: string;
  /** '' when not set: the sentence that uses it is left out. */
  address: string;
}

export function legalDocs({ email, address }: LegalContact): LegalDoc[] {
  return [
    {
      id: 'privacy',
      label: 'Privacy Policy',
      title: 'Privacy Policy',
      sections: [
        {
          heading: 'Who we are',
          body: [
            `${LEGAL_NAME} ("${COMPANY_SHORT}", "we") runs this website and carries the shipments booked through it.${address ? ` Our head office is at ${address}.` : ''} For anything about your personal data, write to ${email}.`
          ]
        },
        {
          heading: 'What we collect',
          body: [
            [
              'Sender and recipient details you give us when you book or ask for a quote: names, company, phone numbers, email and delivery addresses.',
              'Shipment data: contents, weights, sizes, declared value, and the scans and events recorded as the shipment moves.',
              'Messages you send us through the contact, callback and support forms.',
              'Basic technical data: when your browser loads our pages, maps and fonts, the servers involved receive your IP address. We do not use analytics or advertising tools.'
            ]
          ]
        },
        {
          heading: 'Why we use it',
          body: [
            [
              'To collect, carry and deliver your shipments.',
              'To prepare customs and shipping documents.',
              'To answer your questions, handle claims and keep you updated.',
              'To meet our legal, tax and customs duties.'
            ]
          ]
        },
        {
          heading: 'Public tracking',
          body: [
            'Anyone with a tracking ID can follow a shipment. The public tracking page shows only the city and country for each end of the journey, and masks names, phone numbers and email addresses.'
          ]
        },
        {
          heading: 'Who we share it with',
          body: [
            'We share only what each party needs to move your shipment: carriers, agents and handlers on the route, and customs and other authorities. We do not sell personal data.'
          ]
        },
        {
          heading: 'International transfers',
          body: [
            'Because we move goods across borders, shipment details travel with them to the countries on the route. We share only what carriage and customs require.'
          ]
        },
        {
          heading: 'How long we keep it',
          body: [
            'We keep personal data only as long as we need it for the purposes above, including the periods set by tax, customs and transport record-keeping rules.'
          ]
        },
        {
          heading: 'Your rights',
          body: [
            "Depending on where you live (for example under Nigeria's Data Protection Act 2023, or the UK or EU GDPR), you can ask to see the personal data we hold about you, correct it, delete it, or object to how we use it. You can also complain to your data protection authority."
          ]
        },
        {
          heading: 'Privacy requests',
          body: [
            `Email ${email} with your request and, if it concerns a shipment, its tracking ID. We may ask you to confirm your identity before we act on it.`
          ]
        }
      ]
    },
    {
      id: 'terms',
      label: 'Terms of Service',
      title: 'Terms of Service',
      sections: [
        {
          heading: 'Accepting these terms',
          body: [
            'By using this website you agree to these terms. When you book a shipment, our Shipping Terms also apply.'
          ]
        },
        {
          heading: 'Using the website and tracking',
          body: [
            "You can use this website to ask for quotes, book shipments and track them. Please don't misuse it: no automated collection of tracking data, and no attempts to reach other people's shipments or our internal systems.",
            'Tracking updates depend on scans along the route and can be delayed. They are for information and are not a guarantee of delivery times.'
          ]
        },
        {
          heading: 'Quotes and bookings',
          body: [
            'A quote is valid until the date shown on it and covers the shipment you described. If the shipment turns out different (for example heavier, larger or with other contents), the price may change. A booking is confirmed when you receive a tracking ID.'
          ]
        },
        {
          heading: 'Payment and invoicing',
          body: [
            'We invoice each shipment, or as agreed with you in writing. Payment is due as stated on the invoice. Duties, taxes and charges set by authorities are extra unless your quote says otherwise.'
          ]
        },
        {
          heading: 'Limitation of liability',
          body: [
            'As far as the law allows, we are not liable for indirect or consequential losses arising from your use of this website. Our liability for shipments is set out in the Shipping Terms.'
          ]
        },
        {
          heading: 'Changes to these terms',
          body: ['We may update these terms. The date at the top of this page shows the current version.']
        },
        {
          heading: 'Governing law',
          body: [GOVERNING_LAW]
        }
      ]
    },
    {
      id: 'shipping-terms',
      label: 'Shipping Terms',
      title: 'Shipping Terms',
      sections: [
        {
          heading: 'Booking and acceptance',
          body: [
            'We accept a shipment when we collect it, or you hand it to us, and it has a tracking ID. We may inspect, refuse or hold any shipment that does not meet these terms or the law.'
          ]
        },
        {
          heading: 'Prohibited and restricted items',
          body: [
            'You must not send anything that is illegal in the origin, transit or destination country. Items such as dangerous goods, cash, weapons, live animals and perishables are either prohibited or need our agreement before booking. Rules vary by country, so ask us before you book.'
          ]
        },
        {
          heading: 'Packaging',
          body: [
            'You are responsible for packing your shipment to withstand normal handling: use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.'
          ]
        },
        {
          heading: 'Chargeable weight',
          body: [
            'We charge on the greater of the actual weight and the dimensional weight. Dimensional weight in kg = length × width × height in cm ÷ 5000.'
          ]
        },
        {
          heading: 'Surcharges',
          body: [
            'Fuel, remote-area and customs-related surcharges may apply. Every known surcharge is shown on your quote.'
          ]
        },
        {
          heading: 'Duties and taxes',
          body: [
            'Who pays duties and taxes is agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).'
          ]
        },
        {
          heading: 'Delivery and proof of delivery',
          body: [
            'We deliver to the address on the booking. The delivery time and the name of the person who signed are recorded against your tracking ID as proof of delivery.'
          ]
        },
        {
          heading: 'Liability and declared value',
          body: [
            'Our liability for loss or damage is limited. Unless you declare a value and take extended cover when you book, compensation is limited to the standard liability for your service and route, as confirmed at booking. We are not liable for delays or for indirect losses.'
          ]
        },
        {
          heading: 'Claims',
          body: [
            'Tell us within 7 days of delivery. Include your tracking ID, a description of the problem, photos of the goods and the packaging, and proof of value (for example the commercial invoice). We will open a claim and keep you updated.'
          ]
        },
        {
          heading: 'Return to sender',
          body: [
            'If a shipment cannot be delivered or cleared through customs, we contact the sender. It may be returned at the sender\'s cost; a return gets its own tracking ID.'
          ]
        }
      ]
    },
    {
      id: 'cookies',
      label: 'Cookie Policy',
      title: 'Cookie Policy',
      sections: [
        {
          heading: 'Cookies we use',
          body: [
            `We use one essential cookie, ngf.sid. It keeps ${COMPANY_SHORT} staff signed in to our operations console for up to 12 hours. It is not set for visitors to the public website.`,
            'We do not use analytics or advertising cookies. If we add analytics, we will update this page and ask for your consent where the law requires it.'
          ]
        },
        {
          heading: 'Choices saved in your browser',
          body: [
            "Some pages remember a few choices in your browser's local storage. This data stays on your device and is not sent to us:",
            [
              'ngf_recent_tracking: tracking IDs you looked up recently, so you can open them again.',
              'ngf_units: whether you prefer metric or imperial units.',
              'ngf_live_shipment_stream: the latest update for a shipment you are viewing, so other open tabs stay in step.'
            ],
            'You can clear these at any time in your browser settings.'
          ]
        },
        {
          heading: 'Other services our pages use',
          body: [
            'Our pages load map tiles from Esri (ArcGIS), fonts from Google Fonts and some photos from Unsplash, and use OpenStreetMap Nominatim and OSRM to look up addresses and routes. These services receive your IP address when your browser contacts them.'
          ]
        }
      ]
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      title: 'Accessibility',
      sections: [
        {
          heading: 'Our commitment',
          body: [
            'We want everyone to be able to track, book and contact us. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across this website.'
          ]
        },
        {
          heading: 'What we do',
          body: [
            [
              'Forms, buttons and menus work with a keyboard, and form fields have labels.',
              'Images have text alternatives, and text is sized and coloured to stay readable.',
              'Animated maps respect your device\'s reduced-motion setting.',
              'Tracking pages give the route and every scan as text, not only on the map.'
            ]
          ]
        },
        {
          heading: 'Report a barrier',
          body: [
            `If something on this website is hard to use, email ${email}. Tell us the page and what happened, and we will help you get what you need another way while we fix it.`
          ]
        }
      ]
    }
  ];
}

/** Footer line on generated documents (CONTENT §11) links here. */
export const LEGAL_URL = `${DOMAIN}/#/legal`;
