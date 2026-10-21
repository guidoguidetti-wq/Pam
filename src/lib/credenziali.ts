import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const ns = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional()
  )

export const voceSchema = z.object({
  id: z.number().int().positive().optional(),
  descrizione: ns(500),
  utente: ns(500),
  // Password salvata così com'è (niente trim: gli spazi possono far parte della password)
  password: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(1000).nullable().optional()
  ),
})

export const credenzialeSchema = z.object({
  clienteId: z.number().int().positive('Cliente obbligatorio'),
  sezione: z.string().trim().min(1, 'Sezione obbligatoria').max(200),
  ambiente: ns(100),
  note: ns(5000),
  voci: z.array(voceSchema).default([]),
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
