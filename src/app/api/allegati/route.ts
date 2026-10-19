import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serializeAllegato } from '@/lib/allegati'

const uploadSchema = z
  .object({
    spesa_id: z.string().regex(/^\d+$/).nullable(),
    attivita_id: z.string().regex(/^\d+$/).nullable(),
    progetto_id: z.string().regex(/^\d+$/).nullable(),
    descrizione: z.string().trim().max(2000).nullable(),
    data_allegato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable(),
  })
  .refine(d => d.spesa_id || d.attivita_id || d.progetto_id, {
    message: 'spesa_id, attivita_id o progetto_id richiesto',
  })

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const progettoId = new URL(req.url).searchParams.get('progetto_id')
  if (!progettoId || !/^\d+$/.test(progettoId))
    return NextResponse.json({ error: 'progetto_id richiesto' }, { status: 400 })

  try {
    const allegati = await prisma.allegato.findMany({
      where: { progettoId: parseInt(progettoId) },
      orderBy: [{ dataAllegato: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    })
    return NextResponse.json(allegati.map(serializeAllegato))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Configurazione mancante: aggiungere BLOB_READ_WRITE_TOKEN nelle variabili ambiente Vercel' },
      { status: 500 }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 })

  const field = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' && v.trim() !== '' ? v : null
  }
  const parsed = uploadSchema.safeParse({
    spesa_id: field('spesa_id'),
    attivita_id: field('attivita_id'),
    progetto_id: field('progetto_id'),
    descrizione: field('descrizione'),
    data_allegato: field('data_allegato'),
  })
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })
  const { spesa_id, attivita_id, progetto_id, descrizione, data_allegato } = parsed.data

  try {
    // Use a unique filename to avoid collisions
    const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
    const uniqueName = `allegati/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ''}`

    const blob = await put(uniqueName, file, {
      access: 'public',
      contentType: file.type || undefined,
    })

    const allegato = await prisma.allegato.create({
      data: {
        spesaId: spesa_id ? BigInt(spesa_id) : null,
        attivitaId: attivita_id ? BigInt(attivita_id) : null,
        progettoId: progetto_id ? parseInt(progetto_id) : null,
        descrizione,
        dataAllegato: data_allegato ? new Date(data_allegato) : null,
        nomeFile: file.name,
        tipoMime: file.type || null,
        dimensioneBytes: file.size || null,
        storageKey: blob.pathname,
        storageUrl: blob.url,
      },
    })

    return NextResponse.json(serializeAllegato(allegato), { status: 201 })
  } catch (err) {
    console.error('Allegato upload error:', err)
    const message = err instanceof Error ? err.message : 'Errore interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
