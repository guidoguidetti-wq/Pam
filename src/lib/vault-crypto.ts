// Cifratura della cassaforte del Password Manager — eseguita SOLO nel browser (WebCrypto).
//
// Schema:
//   master password ──PBKDF2-SHA256(salt, iterazioni)──▶ KEK (AES-GCM 256)
//   KEK cifra la chiave dati casuale (DEK, AES-GCM 256) → salvata in vault_config.chiave_cifrata
//   DEK cifra utente / password / note / allegati
//
// Il server riceve e salva solo testo cifrato: né la master password né la DEK lasciano il browser.
// Cambiare master password = ricifrare solo la DEK (i dati restano invariati).

export const PREFISSO = 'v1:'
export const ITERAZIONI_DEFAULT = 600_000
const IV_BYTES = 12

type Bytes = Uint8Array<ArrayBuffer>

export type VaultConfigDati = { salt: string; iterazioni: number; chiaveCifrata: string }

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(buf: ArrayBuffer | Bytes): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromB64(s: string): Bytes {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const casuale = (n: number) => crypto.getRandomValues(new Uint8Array(n))

async function derivaKek(masterPassword: string, salt: Bytes, iterazioni: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterazioni },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function cifraBytes(key: CryptoKey, dati: Bytes): Promise<{ iv: Bytes; ct: ArrayBuffer }> {
  const iv = casuale(IV_BYTES)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dati)
  return { iv, ct }
}

const importaDek = (raw: Bytes) =>
  crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

async function avvolgiDek(raw: Bytes, masterPassword: string) {
  const salt = casuale(16)
  const kek = await derivaKek(masterPassword, salt, ITERAZIONI_DEFAULT)
  const { iv, ct } = await cifraBytes(kek, raw)
  return { salt: toB64(salt), iterazioni: ITERAZIONI_DEFAULT, chiaveCifrata: `${PREFISSO}${toB64(iv)}:${toB64(ct)}` }
}

async function svolgiDekRaw(cfg: VaultConfigDati, masterPassword: string): Promise<Bytes> {
  const kek = await derivaKek(masterPassword, fromB64(cfg.salt), cfg.iterazioni)
  const [, ivB64, ctB64] = cfg.chiaveCifrata.split(':')
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, kek, fromB64(ctB64)))
  } catch {
    throw new Error('Master password errata')
  }
}

/** Crea una nuova cassaforte: genera la DEK e la cifra con la master password. */
export async function creaVault(masterPassword: string): Promise<{ config: VaultConfigDati; key: CryptoKey }> {
  const raw = casuale(32)
  const config = await avvolgiDek(raw, masterPassword)
  const key = await importaDek(raw)
  raw.fill(0)
  return { config, key }
}

/** Sblocca la cassaforte: restituisce la DEK (non estraibile). Lancia errore se la password è errata. */
export async function sbloccaVault(cfg: VaultConfigDati, masterPassword: string): Promise<CryptoKey> {
  const raw = await svolgiDekRaw(cfg, masterPassword)
  const key = await importaDek(raw)
  raw.fill(0)
  return key
}

/** Cambia master password: ricifra la sola DEK con la nuova password. */
export async function cambiaMasterPassword(cfg: VaultConfigDati, vecchia: string, nuova: string): Promise<VaultConfigDati> {
  const raw = await svolgiDekRaw(cfg, vecchia)
  const nuovaCfg = await avvolgiDek(raw, nuova)
  raw.fill(0)
  return nuovaCfg
}

export const isCifrato = (v: string | null | undefined): boolean => !!v && v.startsWith(PREFISSO)

/** Cifra una stringa → "v1:<iv>:<dati>". null/'' restano null. */
export async function cifraTesto(key: CryptoKey, testo: string | null | undefined): Promise<string | null> {
  if (testo == null || testo === '') return null
  const { iv, ct } = await cifraBytes(key, enc.encode(testo))
  return `${PREFISSO}${toB64(iv)}:${toB64(ct)}`
}

/** Decifra una stringa. Un valore senza prefisso è un dato in chiaro (precedente alla cifratura) e viene restituito com'è. */
export async function decifraTesto(key: CryptoKey, valore: string | null | undefined): Promise<string | null> {
  if (valore == null) return null
  if (!isCifrato(valore)) return valore
  const [, ivB64, ctB64] = valore.split(':')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64))
  return dec.decode(pt)
}

/** Cifra il contenuto di un file → iv (12 byte) || dati cifrati. */
export async function cifraFile(key: CryptoKey, dati: ArrayBuffer): Promise<Blob> {
  const { iv, ct } = await cifraBytes(key, new Uint8Array(dati))
  return new Blob([iv, ct], { type: 'application/octet-stream' })
}

export async function decifraFile(key: CryptoKey, dati: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(dati)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES) }, key, bytes.subarray(IV_BYTES))
}
