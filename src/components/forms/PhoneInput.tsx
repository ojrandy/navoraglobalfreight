import React, { useEffect, useRef, useState } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { COUNTRIES, formatPhoneNumber, getCountry, isPlausiblePhone } from '../../data/countries';
import './FormControls.css';

interface PhoneInputProps {
  /** Stored value, international format ("+234 803 123 4567") or '' */
  value: string;
  onChange: (value: string) => void;
  /** Calling code to start with while the number is empty (usually the address country). */
  defaultCountry?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

function split(value: string, fallbackCountry: string): { country: string; national: string } {
  const trimmed = (value || '').trim();
  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() };
  }
  // Older records: a number without a calling code, kept as typed.
  return { country: fallbackCountry, national: trimmed };
}

// Phone number with its country calling code. Emits the international format; a number that
// doesn't look valid for the country gets a soft hint, never a blocked form.
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  defaultCountry = 'US',
  id,
  className = '',
  placeholder = 'Phone number',
  required
}) => {
  const initial = split(value, defaultCountry);
  const [country, setCountry] = useState(initial.country || defaultCountry);
  const [national, setNational] = useState(initial.national);
  const lastEmitted = useRef(value);

  // Follow the address country until a number has been typed.
  useEffect(() => {
    if (!national && defaultCountry && getCountry(defaultCountry)) setCountry(defaultCountry);
  }, [defaultCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync when the value is changed from outside (form reset, draft restore).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const next = split(value, defaultCountry);
      setCountry(next.country || defaultCountry);
      setNational(next.national);
      lastEmitted.current = value;
    }
  }, [value, defaultCountry]);

  const emit = (nextCountry: string, nextNational: string) => {
    const full = formatPhoneNumber(nextCountry, nextNational);
    lastEmitted.current = full;
    onChange(full);
  };

  const plausible = isPlausiblePhone(country, national);

  return (
    <div className="sdl-phone-input">
      <select
        aria-label="Country calling code"
        className={`${className} sdl-phone-code`}
        value={country}
        onChange={(e) => {
          setCountry(e.target.value);
          emit(e.target.value, national);
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.code} {c.dialCode}</option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className={`${className} sdl-phone-number`}
        placeholder={placeholder}
        required={required}
        value={national}
        aria-invalid={!plausible || undefined}
        onChange={(e) => {
          setNational(e.target.value);
          emit(country, e.target.value);
        }}
      />
      {!plausible && <small className="sdl-phone-hint">Check the number for {getCountry(country)?.name || country}.</small>}
    </div>
  );
};
