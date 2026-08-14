import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { test } from 'node:test';
import { verifySignature } from '../src/verify';

function b64url(value: string | Buffer): string {
  return Buffer.from(value as Buffer).toString('base64url');
}

type Signer = (signingInput: Buffer) => Buffer;

function makeToken(header: object, payload: object, sign: Signer): string {
  const signingInput = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  return signingInput + '.' + b64url(sign(Buffer.from(signingInput, 'utf-8')));
}

function withDifferentPayload(token: string): string {
  const parts = token.split('.');
  return [parts[0], b64url(JSON.stringify({ sub: 'attacker' })), parts[2]].join('.');
}

function pem(label: string, body: string): string {
  return '-----BEGIN ' + label + '-----\n' +
    (body.match(/.{1,64}/g) ?? []).join('\n') +
    '\n-----END ' + label + '-----\n';
}

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec256 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ec384 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' });
const ec521 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-521' });
const ed = crypto.generateKeyPairSync('ed25519');

const rsaSpki = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const rsaPkcs1 = rsa.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const rsaPrivatePem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const HS_SECRET = 'a-shared-secret';
const CLAIMS = { sub: 'test-user' };

const hmacSigner = (hash: string, secret: Buffer | string): Signer =>
  input => crypto.createHmac(hash, secret).update(input).digest();
const rsaSigner = (hash: string): Signer =>
  input => crypto.sign(hash, input, rsa.privateKey);
const pssSigner = (hash: string, saltLength: number): Signer =>
  input => crypto.sign(hash, input, {
    key: rsa.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength
  });
const ecSigner = (hash: string, key: crypto.KeyObject): Signer =>
  input => crypto.sign(hash, input, { key, dsaEncoding: 'ieee-p1363' });

const SELF_SIGNED_CERT_PEM = pem('CERTIFICATE',
  'MIIDGTCCAgGgAwIBAgIUBhypzvbqI2wZtt8f3LSBGiwE44kwDQYJKoZIhvcNAQELBQAwGzEZMBcGA1UEAwwQand0LXByZXZpZXctdGVzdDAgFw0yNjA4MTQxMjU4NTFaGA8yMTI2MDcyMTEyNTg1MVowGzEZMBcGA1UEAwwQand0LXByZXZpZXctdGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAN5M2KMF99dKMMkkGEkFPP91xCmyEJfLi8pwm0rt6PS6nVVFQUxovfEzrVc6HgS9rh/3LNTIAJ6mI730G5vrvpGY5b4m2+KrpJ+VpSLjRZ2Rjlalf427KWuHWNa1XK41uDfspD1b9bl5EFg9Uk964BuNa5WVwLxyBeo46Vf6G/A3iLmtW9lAYjhWF1+/yEMZWTKdStEB2CCyvAxmkfYyjT7L4acZ80iCMBT3F2OUhG8zRrNQ00Na9azjHyr5WzIz7jr4YrZmGO1YqWVTlq7pz8NPwyiQv4yOTwgYNXsHngS43X7ieb+aCM1oynUxAaQUUDIDOR6W0BVJv2IIpUQ5C5ECAwEAAaNTMFEwHQYDVR0OBBYEFGYToqYpqJF4fwDS+e8OGcXqMBqOMB8GA1UdIwQYMBaAFGYToqYpqJF4fwDS+e8OGcXqMBqOMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAMgK8xVCG5gleR+uWw6jGe2Q8GdiQz0QwidkTCahWwjZMYyzHqhGeELrw25inUQ+WMHamVfgWiB8cav/3W5W/cMDZvAMDGOik+Kyuoy+x+4g8yX2UqmjvgMXL1s/T3IS+S79CcFHRdy7YEuKfukxY2IZeLQByF1PABZuRCwDntVysiNwXw65Xv2kBvbMrOQ0XtIry9oms6uDZDn5R6Q4FdMc30N3DSLaYh6jO1nHPFneKemJ+Mc0aDEmGvukAEKpqC+cQJbPBaPqRfXMuGRF8XKQ9tN8R5p4gQfgclmWVSM0WukEn5e9SXoX1CNhFx/kmTqPRMvqLdaaL1kwN1OmLes=');
const SELF_SIGNED_CERT_KEY_PEM = pem('PRIVATE KEY',
  'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDeTNijBffXSjDJJBhJBTz/dcQpshCXy4vKcJtK7ej0up1VRUFMaL3xM61XOh4Eva4f9yzUyACepiO99Bub676RmOW+Jtviq6SflaUi40WdkY5WpX+Nuylrh1jWtVyuNbg37KQ9W/W5eRBYPVJPeuAbjWuVlcC8cgXqOOlX+hvwN4i5rVvZQGI4Vhdfv8hDGVkynUrRAdggsrwMZpH2Mo0+y+GnGfNIgjAU9xdjlIRvM0azUNNDWvWs4x8q+VsyM+46+GK2ZhjtWKllU5au6c/DT8MokL+Mjk8IGDV7B54EuN1+4nm/mgjNaMp1MQGkFFAyAzkeltAVSb9iCKVEOQuRAgMBAAECggEAWUWWCB3Y8lnGbrgyknxqixJxlOb/192zhTgkfPo+v60Dit9Vgkhb4vXESk+6B2BfAVJDbC3nZc7Fcr6JqduJu7GhrXOwgP46DaZMW07WwZjXBv/OUg4T660+ZXcOwZ0sHjVHnaaE7xdpk24I1Ic9YYMw7bDmZicKLg3t01lLB/OdsfZ8p/rHEBdmKsTHEvac9LYhRngDpcjRbtzoxWQR7ktcFH3Sd6Vc8wFjNiHCDTOOK5NKDpTeunWGkXUD0nvqJIhuZSasghP+mKSU2kL1tbZlqLvOu2eAKfj4zIrtlfPMC7qXkY3VA7lLZ9+zVm2aI2c88+OHh7vz9IGBvEZLiwKBgQDyTbKG+LNlcg1VRmSoWJTAigyL1e3KoQXgIbRnXvctYqKYHQAyVPnDVDZoC3I23iHS7cT8xMjYO52fU1o/tj5WGhLUf/4/tPdHJkuQC1XDvZxaJj+qDztsl4uSur5stssDCipaTQzkIDDHHmz9WfpjAOaBZpF44OzkGuKBkGiwXwKBgQDq3a/IIBkNB5Y3dWD2X+WNC88j1Y26A4yhor31hG+hLtfBvMd6cgn+C+A4/adclyWBdM7En1ADHjXN+rr1ORu2j1dXt1nXEDF7QgLNddlBPKwCWplrShHoUyIzRlOb5N5zXnPqC3mtyu/HcrrSm4lKUC5xD4jrJQ61QCkW2a0KDwKBgH+FKq7kFq4OHzxA5tq+e9L1FHNHrHUW15vEwUgh755gKcg6gw76L9R/7n5Ff9+melCjOCf7fORoQ6VFXdroE9iGsmBJ2Eo4+GbmnZ/6hzGUCcRcGudqStD01MztISjf7unzoKSTpnQtCN7SgXO4thECuU1i6K6gWawXBhxAHwirAoGAP8IEmSBVjJr1pYKA2wE3cK23ArRTcB7Mi4iBZugX4bq0qYxU3qGcotGYggAh8dm6PcV26BuTffUyiAM7w5xIMKwC+vX0NpTXye0mk54dZz9QNqdfpKeL6vS+gQrjYZuk487NSsjotEw2AX/cxZWhlIHlyZ18/tCliICtZt2awvMCgYA1qixh/kWUtGqIJ+7opAgpE6oQc9D62WBd0we44Sf/3a4cbdHVqg8lqakl9sjjZpoI3mXaL7AUtxOnbIqT1iZqE+xDOD3h+EglNicDmJV5RkfqR3tLS89y2skVDtcBZP877aSlC00cT/Bct7G68LfN048csIQizIP8jaznJflKtg==');

for (const [alg, hash] of [['HS256', 'sha256'], ['HS384', 'sha384'], ['HS512', 'sha512']] as const) {
  test(alg + ' verifies against the shared secret', () => {
    const token = makeToken({ alg, typ: 'JWT' }, CLAIMS, hmacSigner(hash, HS_SECRET));
    assert.deepEqual(verifySignature(token, HS_SECRET), { status: 'valid', alg });
  });

  test(alg + ' rejects a tampered payload', () => {
    const token = withDifferentPayload(makeToken({ alg, typ: 'JWT' }, CLAIMS, hmacSigner(hash, HS_SECRET)));
    assert.equal(verifySignature(token, HS_SECRET).status, 'invalid');
  });
}

test('HS256 rejects the wrong secret', () => {
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', HS_SECRET));
  assert.equal(verifySignature(token, 'not-the-secret').status, 'invalid');
});

test('HS256 accepts a Base64-encoded secret when the option is set', () => {
  const secret = crypto.randomBytes(32);
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', secret));
  const encoded = secret.toString('base64');
  assert.equal(verifySignature(token, encoded, { base64Secret: true }).status, 'valid');
  assert.equal(verifySignature(token, encoded).status, 'invalid');
});

test('HS256 accepts a symmetric JWK', () => {
  const secret = crypto.randomBytes(32);
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', secret));
  const jwk = JSON.stringify({ kty: 'oct', k: secret.toString('base64url') });
  assert.equal(verifySignature(token, jwk).status, 'valid');
});

test('HS256 explains that a PEM key cannot be an HMAC secret', () => {
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', HS_SECRET));
  const result = verifySignature(token, rsaSpki);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /shared secret/);
});

for (const [alg, hash] of [['RS256', 'sha256'], ['RS384', 'sha384'], ['RS512', 'sha512']] as const) {
  test(alg + ' verifies against an SPKI public key', () => {
    const token = makeToken({ alg }, CLAIMS, rsaSigner(hash));
    assert.deepEqual(verifySignature(token, rsaSpki), { status: 'valid', alg });
  });

  test(alg + ' rejects a tampered payload', () => {
    assert.equal(verifySignature(withDifferentPayload(makeToken({ alg }, CLAIMS, rsaSigner(hash))), rsaSpki).status, 'invalid');
  });
}

test('RS256 verifies against a PKCS#1 public key', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  assert.equal(verifySignature(token, rsaPkcs1).status, 'valid');
});

test('RS256 verifies against a private key by deriving the public half', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  assert.equal(verifySignature(token, rsaPrivatePem).status, 'valid');
});

test('RS256 verifies against an X.509 certificate', () => {
  const key = crypto.createPrivateKey(SELF_SIGNED_CERT_KEY_PEM);
  const token = makeToken({ alg: 'RS256' }, CLAIMS, input => crypto.sign('sha256', input, key));
  assert.equal(verifySignature(token, SELF_SIGNED_CERT_PEM).status, 'valid');
});

for (const [alg, hash, salt] of [['PS256', 'sha256', 32], ['PS384', 'sha384', 48], ['PS512', 'sha512', 64]] as const) {
  test(alg + ' verifies against an RSA public key', () => {
    const token = makeToken({ alg }, CLAIMS, pssSigner(hash, salt));
    assert.deepEqual(verifySignature(token, rsaSpki), { status: 'valid', alg });
  });
}

test('a PS256 signature does not verify as RS256', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, pssSigner('sha256', 32));
  assert.equal(verifySignature(token, rsaSpki).status, 'invalid');
});

for (const [alg, hash, pair] of [
  ['ES256', 'sha256', ec256], ['ES384', 'sha384', ec384], ['ES512', 'sha512', ec521]
] as const) {
  test(alg + ' verifies a raw r||s signature', () => {
    const token = makeToken({ alg }, CLAIMS, ecSigner(hash, pair.privateKey));
    const spki = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    assert.deepEqual(verifySignature(token, spki), { status: 'valid', alg });
  });

  test(alg + ' rejects a tampered payload', () => {
    const token = withDifferentPayload(makeToken({ alg }, CLAIMS, ecSigner(hash, pair.privateKey)));
    const spki = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    assert.equal(verifySignature(token, spki).status, 'invalid');
  });
}

test('ES256 reports a curve mismatch rather than failing opaquely', () => {
  const token = makeToken({ alg: 'ES256' }, CLAIMS, ecSigner('sha256', ec256.privateKey));
  const wrongCurve = ec384.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const result = verifySignature(token, wrongCurve);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /P-256.*P-384/);
});

test('EdDSA verifies against an Ed25519 public key', () => {
  const token = makeToken({ alg: 'EdDSA' }, CLAIMS, input => crypto.sign(null, input, ed.privateKey));
  const spki = ed.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.deepEqual(verifySignature(token, spki), { status: 'valid', alg: 'EdDSA' });
});

test('RS256 verifies against a JWK', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const jwk = JSON.stringify(rsa.publicKey.export({ format: 'jwk' }));
  assert.equal(verifySignature(token, jwk).status, 'valid');
});

test('a JWK carrying kid, use and alg metadata is still accepted', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const jwk = JSON.stringify({ ...rsa.publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' });
  assert.equal(verifySignature(token, jwk).status, 'valid');
});

test('a JWK Set selects the key matching the token kid', () => {
  const token = makeToken({ alg: 'RS256', kid: 'signing-key' }, CLAIMS, rsaSigner('sha256'));
  const jwks = JSON.stringify({
    keys: [
      { ...ec256.publicKey.export({ format: 'jwk' }), kid: 'other-key' },
      { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'signing-key' }
    ]
  });
  assert.equal(verifySignature(token, jwks).status, 'valid');
});

test('a single-key JWK Set is used even without a kid', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const jwks = JSON.stringify({ keys: [rsa.publicKey.export({ format: 'jwk' })] });
  assert.equal(verifySignature(token, jwks).status, 'valid');
});

test('an ambiguous JWK Set reports why it cannot choose', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const jwks = JSON.stringify({
    keys: [rsa.publicKey.export({ format: 'jwk' }), ec256.publicKey.export({ format: 'jwk' })]
  });
  const result = verifySignature(token, jwks);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /no kid/);
});

test('a JWK Set with no matching kid says so', () => {
  const token = makeToken({ alg: 'RS256', kid: 'missing' }, CLAIMS, rsaSigner('sha256'));
  const jwks = JSON.stringify({ keys: [{ ...rsa.publicKey.export({ format: 'jwk' }), kid: 'other' }] });
  const result = verifySignature(token, jwks);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /missing/);
});

test('an RS256 token with an EC key reports the key type mismatch', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const ecPem = ec256.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const result = verifySignature(token, ecPem);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /needs an RSA key/);
});

test('an RS256 token with a plain secret explains that a public key is needed', () => {
  const token = makeToken({ alg: 'RS256' }, CLAIMS, rsaSigner('sha256'));
  const result = verifySignature(token, 'just-a-secret');
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /PEM or JWK/);
});

test('alg "none" is reported as unsigned rather than valid', () => {
  const token = b64url(JSON.stringify({ alg: 'none' })) + '.' + b64url(JSON.stringify(CLAIMS)) + '.';
  const result = verifySignature(token, HS_SECRET);
  assert.equal(result.status, 'unsigned');
  assert.equal(result.alg, 'none');
});

test('a two-part token is reported as unsigned', () => {
  const token = b64url(JSON.stringify({ alg: 'HS256' })) + '.' + b64url(JSON.stringify(CLAIMS));
  assert.equal(verifySignature(token, HS_SECRET).status, 'unsigned');
});

test('an unknown algorithm is reported as unsupported', () => {
  const token = makeToken({ alg: 'HS1024' }, CLAIMS, hmacSigner('sha512', HS_SECRET));
  const result = verifySignature(token, HS_SECRET);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.alg, 'HS1024');
});

test('a header without alg is an error, not a pass', () => {
  const token = makeToken({ typ: 'JWT' }, CLAIMS, hmacSigner('sha256', HS_SECRET));
  const result = verifySignature(token, HS_SECRET);
  assert.equal(result.status, 'error');
  assert.match(result.message ?? '', /no "alg"/);
});

test('an unreadable header is an error', () => {
  assert.equal(verifySignature('!!!.@@@.###', HS_SECRET).status, 'error');
});

test('an empty key is an error', () => {
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', HS_SECRET));
  assert.equal(verifySignature(token, '   ').status, 'error');
});

test('a non-token input is an error', () => {
  assert.equal(verifySignature('not-a-token', HS_SECRET).status, 'error');
});

test('surrounding whitespace in the token is ignored', () => {
  const token = makeToken({ alg: 'HS256' }, CLAIMS, hmacSigner('sha256', HS_SECRET));
  assert.equal(verifySignature('\n  ' + token + '  \n', HS_SECRET).status, 'valid');
});
