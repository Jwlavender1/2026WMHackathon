'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { locationLabel, type Location, type LocationOption } from '@/lib/location';
import { useApp } from './provider';

export function LocationPicker({
  initial,
  label = 'City / town',
  legacyCity,
}: {
  initial?: Location | null;
  label?: string;
  legacyCity?: string;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const { demo } = useApp();
  const [selected, setSelected] = useState<LocationOption | null>(
    initial ? { location: initial, token: '' } : null,
  );
  const [query, setQuery] = useState(initial ? locationLabel(initial) : '');
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [active, setActive] = useState(-1),
    [focused, setFocused] = useState(false);
  const [message, setMessage] = useState(''),
    [loading, setLoading] = useState(false);
  const open = focused && !selected && options.length > 0;
  useEffect(() => {
    input.current?.setCustomValidity(selected ? '' : 'Select a city from the suggestions.');
  }, [selected]);
  useEffect(() => {
    if (!focused || selected || query.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Unable to search for cities.');
        if (controller.signal.aborted) return;
        setOptions(data.suggestions);
        setActive(-1);
        if (!data.suggestions.length)
          setMessage('No matching city found. Try the city name with its state.');
      } catch (error) {
        if (!controller.signal.aborted)
          setMessage(error instanceof Error ? error.message : 'Unable to search for cities.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused, selected]);
  const choose = (option: LocationOption) => {
    setSelected(option);
    setQuery(locationLabel(option.location));
    setOptions([]);
    setMessage('');
    input.current?.setCustomValidity('');
  };
  return (
    <div className="location-field">
      <label htmlFor={id}>{label}</label>
      <div className="location-input-wrap">
        <MapPin size={18} aria-hidden="true" />
        <input
          ref={input}
          id={id}
          value={query}
          required
          maxLength={100}
          autoComplete="off"
          placeholder="Search a US city, e.g. Williamsburg, VA"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-results`}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-hint ${id}-status`}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setLoading(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOptions([]);
            setActive(-1);
            setMessage('');
            setLoading(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOptions([]);
              setActive(-1);
              return;
            }
            if (open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              setActive((value) => {
                if (value < 0) return event.key === 'ArrowDown' ? 0 : options.length - 1;
                return (
                  (value + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
                );
              });
            } else if (open && event.key === 'Enter') {
              event.preventDefault();
              if (active >= 0) choose(options[active]);
            }
          }}
        />
        {selected && <Check className="location-check" size={18} aria-label="Location selected" />}
      </div>
      <input type="hidden" name="location_id" value={selected?.location.id ?? ''} />
      <input type="hidden" name="location_token" value={selected?.token ?? ''} />
      {open && (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="location-results"
          aria-label="Matching cities"
        >
          {options.map((option, index) => (
            <li
              key={option.location.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={active === index}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={active === index ? 'active' : ''}
            >
              <MapPin size={16} aria-hidden="true" />
              {locationLabel(option.location)}
            </li>
          ))}
        </ul>
      )}
      <small id={`${id}-hint`} className="muted">
        {legacyCity && !initial
          ? `Previously entered: ${legacyCity}. Select a city to confirm the state.`
          : 'Choose a city and state from the suggestions. United States only.'}
      </small>
      <span id={`${id}-status`} className="location-status" aria-live="polite" aria-atomic="true">
        {loading ? 'Searching cities…' : message}
      </span>
      <small className="location-attribution">
        {demo ? (
          'Demo locations: Williamsburg, VA / KY and Richmond, VA.'
        ) : (
          <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
            Location data by Geoapify / OpenStreetMap
          </a>
        )}
      </small>
    </div>
  );
}
