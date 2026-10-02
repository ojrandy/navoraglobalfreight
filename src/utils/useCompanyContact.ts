import { useAdminData } from '../context/AdminDataContext';
import { EMAIL, PHONE, WHATSAPP, HQ_ADDRESS } from '../config/brand';

export interface CompanyContact {
  /** '' when unknown: callers must hide the element rather than show a placeholder. */
  phone: string;
  /** Digits (and a leading +) for tel: links; '' when there is no phone. */
  phoneHref: string;
  whatsapp: string;
  email: string;
  address: string;
  /** Regulatory/licence line from admin Settings; '' when not set. */
  regulatoryLine: string;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Company contact details for the public site. Admin Settings (stored in the DB and editable
 * without a deploy) win; otherwise the values from src/config/brand.ts are used.
 */
export function useCompanyContact(): CompanyContact {
  const { settings } = useAdminData();
  const phone = clean(settings.supportPhone) || PHONE;
  return {
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '',
    whatsapp: WHATSAPP,
    email: clean(settings.dispatchEmail) || EMAIL,
    address: clean(settings.headquartersAddress) || HQ_ADDRESS,
    regulatoryLine: clean(settings.dotNumber),
  };
}
