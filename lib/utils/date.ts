/**
 * Returns the current date in YYYY-MM-DD format based on America/Caracas timezone.
 * Useful for filtering Supabase queries by date without relying on client browser timezone.
 */
export const getCaracasDate = (date: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const ye = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  return `${ye}-${mo}-${da}`;
};

/**
 * Returns the UTC range (ISO strings) for a full day in Caracas.
 * Useful for Supabase .gte and .lte comparisons.
 * @param dateStr Format: YYYY-MM-DD
 */
export const getCaracasDayRange = (dateStr: string) => {
  // Caracas is UTC-4. To get a full day for Caracas:
  // Start: YYYY-MM-DDT00:00:00-04:00
  // End: YYYY-MM-DDT23:59:59-04:00
  const startUtc = new Date(`${dateStr}T00:00:00-04:00`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59-04:00`).toISOString();
  
  return { startUtc, endUtc };
};
