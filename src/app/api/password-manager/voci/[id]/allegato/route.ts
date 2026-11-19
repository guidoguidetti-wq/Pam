import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { eliminaFileVoci } from '@/lib/credenziali'

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 4 * 1024 * 1024 + 64 // limite body funzioni Vercel ~4,5 MB (+ iv e tag della cifratura)

// Scarica l'allegato tramite API autenticata (il client lo decifra se cifrato)
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Id non valido' }, { status: 400 })

  try {
    const voce = await prisma.credenzialeVoce.findUnique({ where: { id: parseInt(id) }, select: { fileUrl: true } })
    if (!voce?.fileUrl) return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 })
    const r = await fetch(voce.fileUrl, { cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ error: 'File non disponibile' }, { status: 502 })
    return new Response(await r.arrayBuffer(), {
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('Download allegato credenziale:', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

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
  const nomeFile = formData.get('nomeFile')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande (max 4 MB)' }, { status: 413 })
  // Si accettano solo file cifrati nel browser
  if (formData.get('cifrato') !== '1' || typeof nomeFile !== 'string' || !nomeFile.trim())
    return NextResponse.json({ error: 'Il file deve essere cifrato prima del caricamento' }, { status: 422 })

  try {
    const voce = await prisma.credenzialeVoce.findUnique({ where: { id: voceId }, select: { fileUrl: true } })
    if (!voce) return NextResponse.json({ error: 'Riga non trovata' }, { status: 404 })

    // Contenuto cifrato: nome casuale senza estensione, tipo generico
    const blob = await put(
      `credenziali/${Date.now()}-${crypto.randomUUID()}.bin`,
      file,
      { access: 'public', contentType: 'application/octet-stream' }
    )

    const aggiornata = await prisma.credenzialeVoce.update({
      where: { id: voceId },
      data: { fileNome: nomeFile.trim().slice(0, 500), fileUrl: blob.url, fileKey: blob.pathname, fileSize: file.size, fileCifrato: true },
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
      data: { fileNome: null, fileUrl: null, fileKey: null, fileSize: null, fileCifrato: false },
    })
    await eliminaFileVoci([voce.fileUrl])
    return NextResponse.json(aggiornata)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
