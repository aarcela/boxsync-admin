import { isValidSlugFormat, slugifyName } from '@/lib/reserved-slugs';

const URL_RE = /https?:\/\/|www\./i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/i;

export const GYM_SIGNUP_FIELD_MAX = {
  gymName: 80,
  slug: 48,
  ownerName: 80,
  email: 120,
  password: 128,
  city: 80,
  instagram: 30,
  phone: 20,
} as const;

export type GymSignupInput = {
  gymName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
  whatsapp: string;
  instagram: string;
  city: string;
  acceptedTerms: boolean;
  turnstileToken: string;
  website?: string;
};

export type GymSignupFieldError = {
  field: keyof GymSignupInput | 'form';
  message: string;
};

function trim(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function normalizeWhatsAppVe(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (/^04\d{9}$/.test(digits)) return `+58${digits.slice(1)}`;
  if (/^4\d{9}$/.test(digits)) return `+58${digits}`;
  if (/^584\d{9}$/.test(digits)) return `+${digits}`;
  if (/^58\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeInstagram(raw: string): string | null {
  const handle = raw.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (!INSTAGRAM_RE.test(handle)) return null;
  return handle;
}

export function parseGymSignupBody(body: unknown): {
  input?: GymSignupInput & { phoneE164: string; instagramHandle: string };
  errors: GymSignupFieldError[];
} {
  const bag = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const gymName = trim(bag.gymName ?? bag.gym_name, GYM_SIGNUP_FIELD_MAX.gymName);
  const slug = trim(bag.slug, GYM_SIGNUP_FIELD_MAX.slug).toLowerCase();
  const ownerName = trim(bag.ownerName ?? bag.owner_name, GYM_SIGNUP_FIELD_MAX.ownerName);
  const email = trim(bag.email, GYM_SIGNUP_FIELD_MAX.email).toLowerCase();
  const password = typeof bag.password === 'string' ? bag.password : '';
  const whatsapp = trim(bag.whatsapp ?? bag.phone, GYM_SIGNUP_FIELD_MAX.phone);
  const instagram = trim(bag.instagram, 80);
  const city = trim(bag.city, GYM_SIGNUP_FIELD_MAX.city);
  const website = typeof bag.website === 'string' ? bag.website : '';
  const acceptedTerms = bag.acceptedTerms === true || bag.accepted_terms === true;
  const turnstileToken = typeof bag.turnstileToken === 'string' ? bag.turnstileToken : typeof bag.turnstile_token === 'string' ? bag.turnstile_token : '';

  const errors: GymSignupFieldError[] = [];

  if (website.trim()) {
    errors.push({ field: 'form', message: 'validation' });
    return { errors };
  }

  if (!gymName) errors.push({ field: 'gymName', message: 'El nombre del gym es obligatorio.' });
  else if (URL_RE.test(gymName)) errors.push({ field: 'gymName', message: 'El nombre del gym no puede contener un enlace.' });

  if (!slug) errors.push({ field: 'slug', message: 'El slug es obligatorio.' });
  else if (!isValidSlugFormat(slug)) errors.push({ field: 'slug', message: 'Usa minúsculas, números y guiones. Ese slug está reservado o no es válido.' });

  if (!ownerName) errors.push({ field: 'ownerName', message: 'Tu nombre es obligatorio.' });
  else if (URL_RE.test(ownerName)) errors.push({ field: 'ownerName', message: 'El nombre no puede contener un enlace.' });

  if (!email || !EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'El correo no es válido.' });

  if (password.length < 8) errors.push({ field: 'password', message: 'La contraseña debe tener al menos 8 caracteres.' });
  if (password.length > GYM_SIGNUP_FIELD_MAX.password) errors.push({ field: 'password', message: 'La contraseña es demasiado larga.' });

  const phoneE164 = normalizeWhatsAppVe(whatsapp);
  if (!phoneE164) errors.push({ field: 'whatsapp', message: 'WhatsApp debe ser un número venezolano (04XX…).' });

  const instagramHandle = normalizeInstagram(instagram);
  if (!instagramHandle) errors.push({ field: 'instagram', message: 'Instagram del gym es obligatorio.' });

  if (!city) errors.push({ field: 'city', message: 'La ciudad es obligatoria.' });
  else if (URL_RE.test(city)) errors.push({ field: 'city', message: 'La ciudad no puede contener un enlace.' });

  if (!acceptedTerms) errors.push({ field: 'acceptedTerms', message: 'Debes aceptar los términos.' });

  if (!turnstileToken && isTurnstileRequired()) {
    errors.push({ field: 'turnstileToken', message: 'Completa el captcha.' });
  }

  if (errors.length > 0) return { errors };

  return {
    input: {
      gymName,
      slug,
      ownerName,
      email,
      password,
      whatsapp,
      instagram: instagramHandle!,
      city,
      acceptedTerms,
      turnstileToken,
      phoneE164: phoneE164!,
      instagramHandle: instagramHandle!,
    },
    errors: [],
  };
}

export function suggestedSlugFromName(gymName: string): string {
  return slugifyName(gymName);
}

export function isTurnstileRequired(): boolean {
  if (process.env.TURNSTILE_SECRET_KEY?.trim()) return true;
  return process.env.NODE_ENV === 'production';
}

export async function verifyTurnstileToken(
  token: string,
  ip: string
): Promise<boolean> {
  if (!isTurnstileRequired()) return true;
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !token) return false;

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: ip,
    });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
