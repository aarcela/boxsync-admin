'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  buildE164,
  splitPhoneE164,
  type PhoneCountry,
} from '@/lib/phone';

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (e164: string) => void;
  className?: string;
  inputClassName?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
};

export function PhoneInput({
  id,
  label,
  value,
  onChange,
  className,
  inputClassName,
  hint,
  required,
  disabled,
}: Props) {
  const initial = useMemo(() => splitPhoneE164(value), []);
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const next = splitPhoneE164(value);
    if (value && digitsMatch(value, country, national)) return;
    setCountry(next.country);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from external value only
  }, [value]);

  function emit(nextCountry: PhoneCountry, nextNational: string) {
    const e164 = buildE164(nextCountry, nextNational);
    onChange(e164 ?? '');
  }

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required ? ' *' : ''}
        </label>
      ) : null}
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          disabled={disabled}
          value={country.iso}
          onChange={(e) => {
            const next =
              PHONE_COUNTRIES.find((c) => c.iso === e.target.value) ??
              DEFAULT_PHONE_COUNTRY;
            setCountry(next);
            emit(next, national);
          }}
          className="w-[7.5rem] shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          value={national}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d\s-]/g, '');
            setNational(next);
            emit(country, next);
          }}
          className={
            inputClassName ??
            'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
          }
          placeholder="412 123 4567"
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function digitsMatch(
  value: string,
  country: PhoneCountry,
  national: string
): boolean {
  const built = buildE164(country, national);
  if (!built && !value) return true;
  return built === value;
}
