import { URL } from 'url';

const WILDCARD_PREFIX = '*.';

export function parseAllowedOrigins(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const normalizedOrigin = parsedOrigin.origin;

  return allowedOrigins.some((allowedOrigin) =>
    matchesAllowedOrigin(normalizedOrigin, allowedOrigin),
  );
}

function matchesAllowedOrigin(origin: string, allowedOrigin: string): boolean {
  let parsedAllowedOrigin: URL;

  try {
    parsedAllowedOrigin = new URL(allowedOrigin.replace(WILDCARD_PREFIX, 'placeholder.'));
  } catch {
    return false;
  }

  const expectedProtocol = parsedAllowedOrigin.protocol;

  if (allowedOrigin.includes(WILDCARD_PREFIX)) {
    return matchesWildcardOrigin(origin, allowedOrigin, expectedProtocol);
  }

  return origin === parsedAllowedOrigin.origin;
}

function matchesWildcardOrigin(origin: string, allowedOrigin: string, expectedProtocol: string): boolean {
  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (parsedOrigin.protocol !== expectedProtocol) {
    return false;
  }

  const allowedHostSuffix = allowedOrigin
    .replace(`${parsedOrigin.protocol}//`, '')
    .replace(WILDCARD_PREFIX, '.');

  return (
    parsedOrigin.hostname.endsWith(allowedHostSuffix) &&
    parsedOrigin.hostname !== allowedHostSuffix.slice(1) &&
    (parsedOrigin.port || defaultPortForProtocol(parsedOrigin.protocol)) ===
      defaultPortForProtocol(expectedProtocol)
  );
}

function defaultPortForProtocol(protocol: string): string {
  if (protocol === 'https:') {
    return '443';
  }

  if (protocol === 'http:') {
    return '80';
  }

  return '';
}
