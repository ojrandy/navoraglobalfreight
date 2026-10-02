import React, { useEffect, useRef, useState } from 'react';
import { useUnitSystem } from '../../utils/useUnitSystem';
import { useCurrency } from '../../utils/useCurrency';
import {
  formatWeight, lengthFromDisplay, lengthToDisplay, lengthUnit, roundForDisplay,
  weightFromDisplay, weightToDisplay, weightUnit
} from '../../shared/units';
import './FormControls.css';

/** kg/cm | lb/in switch. Applies to every form and display on the page. */
export const UnitToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [system, setSystem] = useUnitSystem();
  return (
    <div className={`ngf-unit-toggle ${className}`} role="group" aria-label="Units">
      <button type="button" aria-pressed={system === 'metric'} className={system === 'metric' ? 'active' : ''} onClick={() => setSystem('metric')}>
        kg / cm
      </button>
      <button type="button" aria-pressed={system === 'imperial'} className={system === 'imperial' ? 'active' : ''} onClick={() => setSystem('imperial')}>
        lb / in
      </button>
    </div>
  );
};

type NumberValue = number | '';

interface ConvertedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Canonical value (lb, in or USD), or '' when empty. */
  value: NumberValue | string;
  onChange: (canonical: NumberValue) => void;
  toDisplay: (canonical: number) => number;
  fromDisplay: (display: number) => number;
  digits?: number;
}

const asNumber = (v: NumberValue | string): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// A number input that shows a converted value but keeps the canonical one in state. While the
// field has focus the typed text is kept exactly as typed (so "1." or "0.0" don't jump); it's
// re-derived from the canonical value when focus leaves or the unit/currency changes.
export const ConvertedNumberInput: React.FC<ConvertedNumberInputProps> = ({
  value, onChange, toDisplay, fromDisplay, digits = 2, onFocus, onBlur, ...rest
}) => {
  const canonical = asNumber(value);
  const derived = canonical === null ? '' : roundForDisplay(toDisplay(canonical), digits);
  const [text, setText] = useState(derived);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(derived);
  }, [derived]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(derived);
        onBlur?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        onChange(e.target.value === '' || !Number.isFinite(n) ? '' : fromDisplay(n));
      }}
    />
  );
};

type MeasureProps = Omit<ConvertedNumberInputProps, 'toDisplay' | 'fromDisplay'> & { kind: 'weight' | 'length' };

/** Weight (canonical lb) or length (canonical in) input shown in the viewer's units. */
export const MeasureInput: React.FC<MeasureProps> = ({ kind, digits = 2, ...rest }) => {
  const [system] = useUnitSystem();
  return (
    <ConvertedNumberInput
      {...rest}
      digits={digits}
      toDisplay={(v) => (kind === 'weight' ? weightToDisplay(v, system) : lengthToDisplay(v, system))}
      fromDisplay={(v) => (kind === 'weight' ? weightFromDisplay(v, system) : lengthFromDisplay(v, system))}
    />
  );
};

/** Price input (canonical USD) shown in the display currency from Settings. */
export const MoneyInput: React.FC<Omit<ConvertedNumberInputProps, 'toDisplay' | 'fromDisplay'>> = ({ digits = 2, ...rest }) => {
  const money = useCurrency();
  return <ConvertedNumberInput {...rest} digits={digits} toDisplay={money.toDisplay} fromDisplay={money.fromDisplay} />;
};

/** "kg" / "lb" or "cm" / "in" for the viewer's current units (for labels). */
export function useUnitLabels() {
  const [system] = useUnitSystem();
  return { system, weight: weightUnit(system), length: lengthUnit(system) };
}

/** A stored pound value shown in the viewer's units ("10 kg" / "22 lb"); `fallback` when empty. */
export const WeightText: React.FC<{ lbs: unknown; fallback?: string }> = ({ lbs, fallback = '—' }) => {
  const [system] = useUnitSystem();
  return <>{formatWeight(lbs, system) || fallback}</>;
};
