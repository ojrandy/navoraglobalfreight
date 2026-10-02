import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getCountry, searchCountries, findCountry } from '../../data/countries';
import './FormControls.css';

interface CountrySelectProps {
  /** ISO 3166-1 alpha-2 code, or '' for none. */
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
  'aria-label'?: string;
}

// Searchable country picker (ARIA combobox): type a name, ISO code or calling code, pick with
// the mouse or the arrow keys + Enter.
export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  id,
  className = '',
  placeholder = 'Search country…',
  required,
  'aria-label': ariaLabel
}) => {
  const autoId = useId();
  const inputId = id || `country-${autoId}`;
  const listId = `${inputId}-list`;
  const selected = getCountry(value);
  const [query, setQuery] = useState(selected?.name || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Show the selected country's name whenever the list is closed.
  useEffect(() => {
    if (!open) setQuery(selected?.name || '');
  }, [selected?.name, open]);

  const matches = useMemo(() => searchCountries(open && query !== selected?.name ? query : '').slice(0, 60), [query, open, selected?.name]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery(getCountry(code)?.name || '');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (matches[active]) choose(matches[active].code);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onBlur = () => {
    // Accept an exact name / code / alias typed without picking from the list.
    window.setTimeout(() => {
      const typed = findCountry(query);
      if (typed && typed.code !== value) onChange(typed.code);
      setOpen(false);
    }, 120);
  };

  return (
    <div className="sdl-country-select">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].code}` : undefined}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        required={required && !value}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => {
          setOpen(true);
          setActive(Math.max(0, matches.findIndex((c) => c.code === value)));
          e.target.select();
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={16} className="sdl-country-chevron" aria-hidden="true" />
      {open && (
        <ul id={listId} role="listbox" ref={listRef} className="sdl-country-list">
          {matches.length === 0 && <li className="sdl-country-empty">No matching country</li>}
          {matches.map((c, i) => (
            <li
              key={c.code}
              id={`${listId}-${c.code}`}
              data-index={i}
              role="option"
              aria-selected={c.code === value}
              className={`sdl-country-option ${i === active ? 'active' : ''} ${c.code === value ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c.code);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{c.name}</span>
              <small className="font-mono">{c.code} · {c.dialCode}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
