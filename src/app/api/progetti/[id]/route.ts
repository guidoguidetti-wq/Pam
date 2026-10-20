import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { progettoSchema, progettoInclude, conOrePerTipo, datiProgetto } from '@/lib/progetti'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const progettoId = parseInt(id)
  const body = await req.json()
  const parsed = progettoSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const data = datiProgetto(parsed.data)

  try {
    // Non si può togliere un tipo che ha già attività registrate sul progetto
    const tipiUsati = await prisma.attivita.findMany({
      where: { progettoId },
      distinct: ['tipoAttivitaId'],
      select: { tipoAttivita: { select: { id: true, codice: true } } },
    })
    const tipiNuovi = new Set(data.tipiAttivita.create.map(t => t.tipoAttivitaId))
    const mancanti = tipiUsati.filter(t => !tipiNuovi.has(t.tipoAttivita.id)).map(t => t.tipoAttivita.codice)
    if (mancanti.length > 0)
      return NextResponse.json(
        { error: `Impossibile togliere tipi con attività già registrate: ${mancanti.join(', ')}` },
        { status: 409 }
      )

    const result = await prisma.$transaction(async (tx) => {
      await tx.progettoStima.deleteMany({ where: { progettoId } })
      await tx.progettoTipoAttivita.deleteMany({ where: { progettoId } })
      return tx.progetto.update({
        where: { id: progettoId },
        data,
        include: progettoInclude,
      })
    })
    const [arricchito] = await conOrePerTipo([result])
    return NextResponse.json(arricchito)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params

  try {
    const progetto = await prisma.progetto.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: { select: { attivita: true } },
        allegati: { select: { storageUrl: true } },
      },
    })
    if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
    if (progetto._count.attivita > 0)
      return NextResponse.json(
        { error: 'Impossibile eliminare: il progetto ha attività collegate' },
        { status: 409 }
      )

    // I record allegato vanno in cascade, i file su Blob vanno rimossi a mano
    const urls = progetto.allegati.map(a => a.storageUrl).filter((u): u is string => !!u)
    if (urls.length > 0) await del(urls)

    await prisma.progetto.delete({ where: { id: parseInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
