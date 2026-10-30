export const FOUNDER_WHATSAPP_E164 = '584129968003';
export const FOUNDER_WHATSAPP_URL = `https://wa.me/${FOUNDER_WHATSAPP_E164}`;

export function founderWhatsAppUrl(text: string): string {
  return `${FOUNDER_WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}

export function setupHelpWhatsAppText(gymName: string): string {
  return `Hola, acabo de registrar ${gymName} en WODUS y quiero ayuda para configurarlo`;
}

export function loadMembersWhatsAppText(gymName: string): string {
  return `Hola, quiero que me ayuden a cargar los miembros de ${gymName} en WODUS`;
}

export function emailExistsHelpWhatsAppText(): string {
  return 'Hola, quiero registrar mi gym en WODUS pero mi correo ya tiene cuenta';
}

export function getSignupAlertEmail(): string {
  return process.env.SIGNUP_ALERT_EMAIL?.trim() || 'contact@getwodus.com';
}
