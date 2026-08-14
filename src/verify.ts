import * as crypto from 'crypto';

export type VerifyStatus = 'valid' | 'invalid' | 'unsigned' | 'unsupported' | 'error';

export interface VerifyResult {
  status: VerifyStatus;
  alg?: string;
  message?: string;
}

export interface VerifyOptions {
  base64Secret?: boolean;
}

type AlgorithmFamily = 'hmac' | 'rsa' | 'rsa-pss' | 'ec' | 'eddsa';

interface AlgorithmSpec {
  family: AlgorithmFamily;
  digest: string | null;
  jwkCurve?: string;
  pssSaltLength?: number;
}

const ALGORITHMS: Record<string, AlgorithmSpec> = {
  HS256: { family: 'hmac', digest: 'sha256' },
  HS384: { family: 'hmac', digest: 'sha384' },
  HS512: { family: 'hmac', digest: 'sha512' },
  RS256: { family: 'rsa', digest: 'sha256' },
  RS384: { family: 'rsa', digest: 'sha384' },
  RS512: { family: 'rsa', digest: 'sha512' },
  PS256: { family: 'rsa-pss', digest: 'sha256', pssSaltLength: 32 },
  PS384: { family: 'rsa-pss', digest: 'sha384', pssSaltLength: 48 },
  PS512: { family: 'rsa-pss', digest: 'sha512', pssSaltLength: 64 },
  ES256: { family: 'ec', digest: 'sha256', jwkCurve: 'P-256' },
  ES384: { family: 'ec', digest: 'sha384', jwkCurve: 'P-384' },
  ES512: { family: 'ec', digest: 'sha512', jwkCurve: 'P-521' },
  EdDSA: { family: 'eddsa', digest: null }
};

const JWK_CURVE_BY_OPENSSL_CURVE: Record<string, string> = {
  prime256v1: 'P-256',
  secp384r1: 'P-384',
  secp521r1: 'P-521'
};

const JWS_ECDSA_SIGNATURE_ENCODING = 'ieee-p1363';
const PEM_HEADER_MARKER = '-----BEGIN';

function decodeHeader(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf-8')) as Record<string, unknown>;
}

function readAlg(segment: string): string | undefined {
  const alg = decodeHeader(segment).alg;
  return typeof alg === 'string' ? alg : undefined;
}

function readKid(segment: string): string | undefined {
  try {
    const kid = decodeHeader(segment).kid;
    return typeof kid === 'string' ? kid : undefined;
  } catch (e) {
    return undefined;
  }
}

function selectJwk(parsed: unknown, kid: string | undefined): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The key is not a JSON object.');
  }
  const keySetOrKey = parsed as Record<string, unknown>;
  if (!Array.isArray(keySetOrKey.keys)) {
    return keySetOrKey;
  }
  const keys = keySetOrKey.keys as Array<Record<string, unknown>>;
  if (keys.length === 0) {
    throw new Error('The JWK Set contains no keys.');
  }
  if (kid !== undefined) {
    const matching = keys.find(key => key.kid === kid);
    if (!matching) {
      throw new Error('No key in the JWK Set matches the token\'s kid "' + kid + '".');
    }
    return matching;
  }
  if (keys.length > 1) {
    throw new Error('The JWK Set contains ' + keys.length +
      ' keys and the token header has no kid to choose between them.');
  }
  return keys[0];
}

function toHmacSecret(keyText: string, kid: string | undefined, options: VerifyOptions): Buffer {
  if (keyText.includes(PEM_HEADER_MARKER)) {
    throw new Error('This token uses HMAC, which needs the shared secret rather than a PEM key.');
  }
  if (keyText.startsWith('{')) {
    const jwk = selectJwk(JSON.parse(keyText), kid);
    if (jwk.kty !== 'oct' || typeof jwk.k !== 'string') {
      throw new Error('This token uses HMAC, so the JWK must be a symmetric key (kty "oct").');
    }
    return Buffer.from(jwk.k, 'base64url');
  }
  return Buffer.from(keyText, options.base64Secret ? 'base64' : 'utf-8');
}

function toPublicKey(keyText: string, kid: string | undefined): crypto.KeyObject {
  if (keyText.startsWith('{')) {
    const jwk = selectJwk(JSON.parse(keyText), kid);
    if (jwk.kty === 'oct') {
      throw new Error('This token uses an asymmetric algorithm, ' +
        'so a symmetric JWK (kty "oct") cannot verify it.');
    }
    return crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' });
  }
  if (!keyText.includes(PEM_HEADER_MARKER)) {
    throw new Error('This token uses an asymmetric algorithm — ' +
      'provide a public key as PEM or JWK, not a plain secret.');
  }
  if (keyText.includes('PRIVATE KEY')) {
    return crypto.createPublicKey(crypto.createPrivateKey(keyText));
  }
  return crypto.createPublicKey(keyText);
}

function assertKeyTypeMatchesAlg(key: crypto.KeyObject, alg: string, spec: AlgorithmSpec): void {
  const keyType = key.asymmetricKeyType;
  const describedType = keyType ?? 'of an unknown type';

  if (spec.family === 'rsa' || spec.family === 'rsa-pss') {
    if (keyType !== 'rsa' && keyType !== 'rsa-pss') {
      throw new Error(alg + ' needs an RSA key, but this key is ' + describedType + '.');
    }
    return;
  }
  if (spec.family === 'ec') {
    if (keyType !== 'ec') {
      throw new Error(alg + ' needs an EC key, but this key is ' + describedType + '.');
    }
    const opensslCurve = key.asymmetricKeyDetails?.namedCurve;
    const curve = opensslCurve ? (JWK_CURVE_BY_OPENSSL_CURVE[opensslCurve] ?? opensslCurve) : undefined;
    if (curve && curve !== spec.jwkCurve) {
      throw new Error(alg + ' needs a ' + spec.jwkCurve + ' key, but this key uses ' + curve + '.');
    }
    return;
  }
  if (keyType !== 'ed25519' && keyType !== 'ed448') {
    throw new Error('EdDSA needs an Ed25519 or Ed448 key, but this key is ' + describedType + '.');
  }
}

function hmacMatches(
  spec: AlgorithmSpec,
  signingInput: Buffer,
  signature: Buffer,
  keyText: string,
  kid: string | undefined,
  options: VerifyOptions
): boolean {
  const secret = toHmacSecret(keyText, kid, options);
  const expected = crypto.createHmac(spec.digest as string, secret).update(signingInput).digest();
  return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
}

function asymmetricSignatureMatches(
  alg: string,
  spec: AlgorithmSpec,
  signingInput: Buffer,
  signature: Buffer,
  keyText: string,
  kid: string | undefined
): boolean {
  const key = toPublicKey(keyText, kid);
  assertKeyTypeMatchesAlg(key, alg, spec);

  if (spec.family === 'eddsa') {
    return crypto.verify(null, signingInput, key, signature);
  }
  if (spec.family === 'ec') {
    return crypto.verify(spec.digest, signingInput,
      { key, dsaEncoding: JWS_ECDSA_SIGNATURE_ENCODING }, signature);
  }
  const padding = spec.family === 'rsa-pss'
    ? crypto.constants.RSA_PKCS1_PSS_PADDING
    : crypto.constants.RSA_PKCS1_PADDING;
  return crypto.verify(spec.digest, signingInput,
    { key, padding, saltLength: spec.pssSaltLength }, signature);
}

export function verifySignature(token: string, keyText: string, options: VerifyOptions = {}): VerifyResult {
  const trimmedKey = keyText.trim();
  if (!trimmedKey) {
    return { status: 'error', message: 'No key or secret provided.' };
  }

  const parts = token.trim().split('.');
  if (parts.length < 2 || parts.length > 3) {
    return { status: 'error', message: 'This does not look like a JWT.' };
  }

  let alg: string | undefined;
  try {
    alg = readAlg(parts[0]);
  } catch (e) {
    return { status: 'error', message: 'The token header could not be read.' };
  }
  if (alg === undefined) {
    return {
      status: 'error',
      message: 'The token header has no "alg" value, so there is nothing to verify against.'
    };
  }

  if (alg === 'none' || parts.length < 3 || parts[2] === '') {
    return {
      status: 'unsigned',
      alg,
      message: 'This token carries no signature, so there is nothing to verify.'
    };
  }

  const spec = ALGORITHMS[alg];
  if (!spec) {
    return { status: 'unsupported', alg, message: 'Signature algorithm "' + alg + '" is not supported.' };
  }

  const signingInput = Buffer.from(parts[0] + '.' + parts[1], 'utf-8');
  const signature = Buffer.from(parts[2], 'base64url');
  const kid = readKid(parts[0]);

  try {
    const matches = spec.family === 'hmac'
      ? hmacMatches(spec, signingInput, signature, trimmedKey, kid, options)
      : asymmetricSignatureMatches(alg, spec, signingInput, signature, trimmedKey, kid);
    return matches
      ? { status: 'valid', alg }
      : { status: 'invalid', alg, message: 'The signature does not match this key.' };
  } catch (e) {
    return { status: 'error', alg, message: e instanceof Error ? e.message : String(e) };
  }
}
