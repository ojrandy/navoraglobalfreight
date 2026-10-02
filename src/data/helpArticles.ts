// Help Centre knowledge base (docs/CONTENT.md §8.2). Used by the Help page and by the
// "Quick answers" block on the Contact page (§8.3).

export type HelpCategory = 'tracking' | 'booking' | 'customs' | 'documents';

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  question: string;
  answer: string;
}

export const HELP_CATEGORIES: { id: HelpCategory; label: string }[] = [
  { id: 'tracking', label: 'Tracking' },
  { id: 'booking', label: 'Booking & collection' },
  { id: 'customs', label: 'Customs & international' },
  { id: 'documents', label: 'Documents & delivery' },
];

// Answers marked [confirm] in CONTENT §8.2 are shown as written, pending the owner (tracker Blocked).
export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'find-id',
    category: 'tracking',
    question: 'Where do I find my tracking ID?',
    answer: "On your booking confirmation, at the top of your waybill and on every piece label. It's 8 characters and starts with NGF (e.g. NGF7K2M9).",
  },
  {
    id: 'not-updated',
    category: 'tracking',
    question: "Why hasn't my tracking updated?",
    answer: 'Updates appear at each scan. On long air or ocean legs there can be several hours between scans. The estimated position keeps moving in the meantime.',
  },
  {
    id: 'multi-piece',
    category: 'tracking',
    question: 'How do multi-piece shipments work?',
    answer: 'All pieces share one tracking ID. Each piece has its own label ending in -01, -02 and so on.',
  },
  {
    id: 'cut-off',
    category: 'booking',
    question: "What's the cut-off for same-day collection?",
    answer: 'It depends on your city and service. Your coordinator confirms it at booking.',
  },
  {
    id: 'packing',
    category: 'booking',
    question: 'How should I pack my shipment?',
    answer: 'Use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.',
  },
  {
    id: 'change-address',
    category: 'booking',
    question: 'Can I change the delivery address?',
    answer: 'Yes, before the shipment reaches the destination gateway. Contact us with your tracking ID.',
  },
  {
    id: 'duties',
    category: 'customs',
    question: 'Who pays duties and taxes?',
    answer: "That's agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).",
  },
  {
    id: 'customs-documents',
    category: 'customs',
    question: 'What documents do I need?',
    answer: "Usually a commercial invoice and, for some goods, permits or certificates. We'll tell you exactly what your lane needs.",
  },
  {
    id: 'prohibited',
    category: 'customs',
    question: "What can't I ship?",
    answer: 'Prohibited and restricted items vary by country. See our Shipping Terms, or ask us before you book.',
  },
  {
    id: 'pod',
    category: 'documents',
    question: "Where's my proof of delivery?",
    answer: 'On your tracking page as soon as the shipment is delivered, available to download as a PDF.',
  },
  {
    id: 'damaged',
    category: 'documents',
    question: 'What if my shipment is damaged?',
    answer: "Tell us within 7 days of delivery, with photos. We'll open a claim and keep you updated.",
  },
];

// Contact page "Quick answers" (§8.3: 3–4 items from §8.2).
export const CONTACT_QUICK_ANSWER_IDS = ['find-id', 'change-address', 'duties', 'damaged'];
