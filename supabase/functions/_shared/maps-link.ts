// Extrai coordenadas de links do Google Maps ou de texto "lat, lng".
// Partilhado entre o painel admin (links diretos) e a edge function
// `clock-tag-manage` (links curtos maps.app.goo.gl, que o browser não segue).
//
// Formatos suportados:
//   38.72230, -9.13930                                  (copiado ao clicar no mapa)
//   https://www.google.com/maps/place/…/@38.7,-9.1,17z/data=…!3d38.72!4d-9.13…
//   https://www.google.com/maps?q=38.72,-9.13            (q, query, ll, destination…)
//   https://www.google.com/maps/search/38.72,+-9.13
//   https://www.google.com/maps/@38.72,-9.13,17z         (centro do mapa → 'viewport')
//   https://consent.google.com/…?continue=<url>          (página de consentimento UE)

export interface MapsCoordinates {
  lat: number;
  lng: number;
  /** 'pin' = ponto marcado; 'viewport' = apenas o centro do mapa visível. */
  precision: 'pin' | 'viewport';
}

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PAIR = new RegExp(`^\\s*(?:loc:)?\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*$`);
const PIN = new RegExp(`!3d${NUM}!4d${NUM}`);
const SEARCH_PATH = new RegExp(`/search/${NUM},\\+?\\s*${NUM}`);
const VIEWPORT = new RegExp(`@${NUM},${NUM}`);
const COORD_PARAMS = ['q', 'query', 'll', 'destination', 'daddr', 'center', 'sll'];

export const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

/** Hosts Google aceites ao seguir redirecionamentos (evita pedidos para outros sites). */
export const isGoogleHost = (hostname: string): boolean =>
  /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.co)$/i.test(hostname);

/** Link de pesquisa Google (google.pt/search?q=…): só traz texto, nunca coordenadas. */
export const isGoogleSearchLink = (raw: string): boolean => {
  try {
    const url = new URL(raw.trim());
    return isGoogleHost(url.hostname) && url.pathname === '/search';
  } catch {
    return false;
  }
};

export const isShortMapsLink = (raw: string): boolean => {
  try {
    return SHORT_LINK_HOSTS.includes(new URL(raw.trim()).hostname.toLowerCase());
  } catch {
    return false;
  }
};

const build = (
  lat: string,
  lng: string,
  precision: MapsCoordinates['precision']
): MapsCoordinates | null => {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { lat: a, lng: b, precision };
};

const fromMatch = (
  match: RegExpMatchArray | null,
  precision: MapsCoordinates['precision']
): MapsCoordinates | null => (match ? build(match[1], match[2], precision) : null);

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Coordenadas contidas num link do Google Maps ou em texto "lat, lng".
 * Dá prioridade ao ponto marcado sobre o centro do mapa.
 * Nunca usar sobre o HTML das páginas Google: o mapa estático lá contido é o
 * centro genérico da região do visitante, não o local (ex.: centro de Portugal).
 */
export const extractMapsCoordinates = (raw: string, depth = 0): MapsCoordinates | null => {
  const text = raw.trim();
  if (!text) return null;

  const plain = fromMatch(text.match(PAIR), 'pin');
  if (plain) return plain;

  const decoded = safeDecode(text);
  const pin = fromMatch(decoded.match(PIN), 'pin');
  if (pin) return pin;

  let url: URL | null = null;
  try {
    url = new URL(text);
  } catch {
    url = null;
  }
  if (url) {
    const next = url.searchParams.get('continue');
    if (next && depth < 3) {
      const nested = extractMapsCoordinates(next, depth + 1);
      if (nested) return nested;
    }
    for (const param of COORD_PARAMS) {
      const value = url.searchParams.get(param);
      const found = value ? fromMatch(value.match(PAIR), 'pin') : null;
      if (found) return found;
    }
  }

  return (
    fromMatch(decoded.match(SEARCH_PATH), 'pin') ?? fromMatch(decoded.match(VIEWPORT), 'viewport')
  );
};
