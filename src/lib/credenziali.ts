import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const ns = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional()
  )

// Valore cifrato nel browser (vedi src/lib/vault-crypto.ts): "v1:<iv base64>:<dati base64>".
// Il server rifiuta qualsiasi valore in chiaro per utente, password e note.
const CIFRATO_RE = /^v1:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/
const cifrato = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(max).regex(CIFRATO_RE, 'Valore non cifrato').nullable().optional()
  )

export const voceSchema = z.object({
  id: z.number().int().positive().optional(),
  descrizione: ns(500),
  utente: cifrato(4000),
  password: cifrato(4000),
})

export const credenzialeSchema = z.object({
  clienteId: z.number().int().positive('Cliente obbligatorio'),
  sezione: z.string().trim().min(1, 'Sezione obbligatoria').max(200),
  ambiente: ns(100),
  note: cifrato(20000),
  voci: z.array(voceSchema).default([]),
})

export const vaultConfigSchema = z.object({
  salt: z.string().min(16).max(200),
  iterazioni: z.number().int().min(100_000).max(10_000_000),
  chiaveCifrata: z.string().max(500).regex(CIFRATO_RE),
})

export const credenzialeInclude = {
  cliente: {
    select: { id: true, ragioneSociale: true, committente: { select: { id: true, ragioneSociale: true } } },
  },
  voci: { orderBy: [{ ordine: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.CredenzialeInclude

// Elimina da Vercel Blob i file allegati alle righe (errori solo loggati: il DB resta la fonte di verità)
export async function eliminaFileVoci(urls: (string | null | undefined)[]) {
  const daEliminare = urls.filter((u): u is string => !!u)
  if (daEliminare.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return
  try {
    const { del } = await import('@vercel/blob')
    await del(daEliminare)
  } catch (err) {
    console.error('Eliminazione file credenziali non riuscita:', err)
  }
}
