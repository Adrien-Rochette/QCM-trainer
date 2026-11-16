/**
 * Génère un identifiant unique (UUID v4).
 * `crypto.randomUUID` n'existe que dans un contexte sécurisé (HTTPS ou localhost) :
 * on prévoit un repli basé sur `crypto.getRandomValues` pour un accès via le réseau local.
 */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Identifiants lisibles pour les propositions d'un QCM : a, b, c… puis c27, c28… */
export function choiceIdAt(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : `c${index + 1}`;
}

/** Transforme un titre en nom de fichier sûr : « Histoire de France » → « histoire-de-france ». */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'sujet';
}
