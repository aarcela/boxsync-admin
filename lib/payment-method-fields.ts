import type { PaymentMethodType } from './types/gym';
import type { TranslationKey } from './translations';

export interface PaymentMethodFieldDef {
  key: string;
  label: TranslationKey;
  placeholder?: string;
}

/** Structured fields collected per method_type. 'otro' keeps the legacy free-text `details` box instead. */
export const PAYMENT_METHOD_FIELD_DEFS: Record<Exclude<PaymentMethodType, 'otro'>, PaymentMethodFieldDef[]> = {
  pago_movil: [
    { key: 'banco', label: 'Bank' },
    { key: 'telefono', label: 'Phone' },
    { key: 'cedula', label: 'ID (Cédula/RIF)' },
  ],
  zelle: [
    { key: 'correo', label: 'Email' },
    { key: 'nombre_completo', label: 'Full name' },
  ],
  binance: [
    { key: 'pay_id', label: 'Binance Pay ID' },
    { key: 'correo', label: 'Email (optional)' },
  ],
  efectivo: [],
};

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, TranslationKey> = {
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  binance: 'Binance Pay',
  efectivo: 'Cash',
  otro: 'Other',
};

export const PAYMENT_METHOD_TYPES: PaymentMethodType[] = ['pago_movil', 'zelle', 'binance', 'efectivo', 'otro'];
