import { useEffect, useState } from 'react';
import type { UnitSystem } from '../shared/units';

// The viewer's weight/dimension units: kg/cm by default, lb/in when toggled. A per-viewer
// preference (localStorage), shared live by every form and display on the page.

const STORAGE_KEY = 'sdl_units';
const listeners = new Set<(system: UnitSystem) => void>();

function readStored(): UnitSystem {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

let current: UnitSystem = typeof window === 'undefined' ? 'metric' : readStored();

export function setUnitSystem(system: UnitSystem) {
  current = system;
  try {
    localStorage.setItem(STORAGE_KEY, system);
  } catch {
    // Private mode / blocked storage: the choice still applies for this page view.
  }
  listeners.forEach((fn) => fn(system));
}

export function useUnitSystem(): [UnitSystem, (system: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>(current);
  useEffect(() => {
    listeners.add(setSystem);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        current = readStored();
        setSystem(current);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(setSystem);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return [system, setUnitSystem];
}
