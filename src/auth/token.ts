/**
 * Lecture des revendications d'un jeton JWT (EV-48).
 *
 * Le contrat gelé ne publie aucun endpoint de profil : le rôle et l'échéance
 * du jeton ne s'obtiennent qu'en lisant sa charge utile. La signature, elle,
 * n'est pas vérifiée ici et ne peut pas l'être — la clé HS256 est le secret de
 * l'API et n'a rien à faire dans un navigateur. Ce décodage sert donc
 * uniquement à l'affichage et à la programmation de l'échéance côté client :
 * l'autorité reste l'API, qui revérifie le jeton à chaque requête.
 */

/** Revendications exploitées par le dashboard, telles que signées par l'API. */
export interface TokenClaims {
  /** Identifiant de connexion, revendication `sub` du jeton. */
  username: string;
  /** Rôle applicatif porté par le jeton. `null` si absent ou inconnu. */
  role: "reader" | "writer" | null;
  /** Échéance en millisecondes epoch, `null` si le jeton n'en porte pas. */
  expiresAtMs: number | null;
}

function decodeSegment(segment: string): unknown {
  // base64url → base64 : l'alphabet du JWT remplace « + » et « / », et
  // supprime le remplissage, qu'il faut rétablir avant d'appeler atob.
  const base64 = segment.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  // atob rend des octets : les repasser en UTF-8 pour ne pas mutiler un
  // identifiant accentué.
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function readString(claims: Record<string, unknown>, name: string): string | null {
  const value = claims[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Décode la charge utile d'un jeton, ou rend `null` si elle est illisible.
 *
 * Un jeton tronqué ou mal formé ne doit pas faire tomber l'écran de connexion :
 * il est traité comme une absence de session, ce qui ramène l'utilisateur au
 * formulaire plutôt que sur une page blanche.
 */
export function decodeTokenClaims(token: string): TokenClaims | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  let payload: unknown;
  try {
    payload = decodeSegment(segments[1]);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const claims = payload as Record<string, unknown>;
  const username = readString(claims, "sub");
  if (username === null) {
    // Sans `sub`, le jeton n'identifie personne : inexploitable.
    return null;
  }

  const role = readString(claims, "role");
  const expiration = claims.exp;
  return {
    username,
    role: role === "reader" || role === "writer" ? role : null,
    // `exp` est en secondes epoch (RFC 7519), l'application raisonne en
    // millisecondes.
    expiresAtMs: typeof expiration === "number" ? expiration * 1000 : null,
  };
}

/** Vrai si le jeton est échu à l'instant donné. Un jeton sans `exp` ne l'est jamais. */
export function isExpired(claims: TokenClaims, now: Date = new Date()): boolean {
  return claims.expiresAtMs !== null && claims.expiresAtMs <= now.getTime();
}
