import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const spesaId = formData.get('spesa_id') as string | null
  const attivitaId = formData.get('attivita_id') as string | null

  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  if (!spesaId && !attivitaId)
    return NextResponse.json({ error: 'spesa_id o attivita_id richiesto' }, { status: 400 })

  try {
    const blob = await put(file.name, file, { access: 'public' })

    const allegato = await prisma.allegato.create({
      data: {
        spesaId: spesaId ? BigInt(spesaId) : null,
        attivitaId: attivitaId ? BigInt(attivitaId) : null,
        nomeFile: file.name,
        tipoMime: file.type || null,
        dimensioneBytes: file.size || null,
        storageKey: blob.pathname,
        storageUrl: blob.url,
      },
    })

    return NextResponse.json(
      {
        ...allegato,
        id: allegato.id.toString(),
        spesaId: allegato.spesaId?.toString() ?? null,
        attivitaId: allegato.attivitaId?.toString() ?? null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
