/**
 * Fictional member names for demo tenants. Common Venezuelan first names and surnames,
 * combined at random with a seed (same slug → same names). Never taken from the studio
 * or its Instagram, so they don't point to real members.
 */
const FIRST_NAMES = [
  'Andrea', 'Gabriela', 'Daniela', 'Valentina', 'María', 'Carolina', 'Mariana', 'Isabella',
  'Sofía', 'Camila', 'Paola', 'Alejandra', 'Fernanda', 'Natalia', 'Verónica', 'Lucía',
  'Patricia', 'Adriana', 'Rosa', 'Elena', 'Victoria', 'Andreína', 'Oriana', 'Yusmary',
  'Génesis', 'Karla', 'Luisa', 'Carmen', 'Diana', 'Estefanía', 'José', 'Luis', 'Carlos',
  'Jesús', 'Miguel', 'Juan', 'Daniel', 'Alejandro', 'Gabriel', 'Ricardo', 'Andrés',
  'Javier', 'Manuel', 'Eduardo', 'Rafael', 'Diego', 'Samuel', 'Sebastián', 'Héctor',
  'Óscar', 'Franklin', 'Jorge', 'Pedro', 'Ángel', 'Víctor', 'Kevin', 'Leonardo', 'Simón',
  'Alberto', 'Gustavo',
];

const LAST_NAMES = [
  'González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Díaz',
  'Ramírez', 'Torres', 'Rojas', 'Morales', 'Sánchez', 'Flores', 'Romero', 'Castillo',
  'Mendoza', 'Medina', 'Guerrero', 'Rivas', 'Suárez', 'Contreras', 'Gutiérrez', 'Silva',
  'Blanco', 'Vargas', 'Herrera', 'Moreno', 'Marcano', 'Ortega', 'Parra', 'Salazar',
  'Briceño', 'Aguilar', 'Chacón', 'Quintero', 'Peña', 'Delgado', 'Fernández', 'Acosta',
];

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** `count` unique "First Last" names for this seed. */
export function fictionalNames(seed: string, count: number): string[] {
  const rand = seededRandom(`names:${seed}`);
  const names = new Set<string>();
  while (names.size < count) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    names.add(`${first} ${last}`);
  }
  return [...names];
}
