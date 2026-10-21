import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { eliminaFileVoci } from '@/lib/credenziali'

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 4 * 1024 * 1024 // limite body funzioni Vercel ~4,5 MB

// Carica (o sostituisce) l'allegato di una riga di credenziali
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json(
      { error: 'Configurazione mancante: aggiungere BLOB_READ_WRITE_TOKEN nelle variabili ambiente Vercel' },
      { status: 500 }
    )

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Id non valido' }, { status: 400 })
  const voceId = parseInt(id)

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande (max 4 MB)' }, { status: 413 })

  try {
    const voce = await prisma.credenzialeVoce.findUnique({ where: { id: voceId }, select: { fileUrl: true } })
    if (!voce) return NextResponse.json({ error: 'Riga non trovata' }, { status: 404 })

    const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
    const blob = await put(
      `credenziali/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ''}`,
      file,
      { access: 'public', contentType: file.type || 'application/octet-stream' }
    )

    const aggiornata = await prisma.credenzialeVoce.update({
      where: { id: voceId },
      data: { fileNome: file.name.slice(0, 500), fileUrl: blob.url, fileKey: blob.pathname, fileSize: file.size },
    })
    if (voce.fileUrl) await eliminaFileVoci([voce.fileUrl])
    return NextResponse.json(aggiornata)
  } catch (err) {
    console.error('Upload allegato credenziale:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Errore interno' }, { status: 500 })
  }
}

// Rimuove l'allegato di una riga
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Id non valido' }, { status: 400 })

  try {
    const voce = await prisma.credenzialeVoce.findUnique({ where: { id: parseInt(id) }, select: { fileUrl: true } })
    if (!voce) return NextResponse.json({ error: 'Riga non trovata' }, { status: 404 })
    const aggiornata = await prisma.credenzialeVoce.update({
      where: { id: parseInt(id) },
      data: { fileNome: null, fileUrl: null, fileKey: null, fileSize: null },
    })
    await eliminaFileVoci([voce.fileUrl])
    return NextResponse.json(aggiornata)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
