import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

const rigaSchema = z.object({
  tipoAttivitaId: z.number().int().positive(),
  descrizione: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(5000).nullable().optional()
  ),
  giorni: z.coerce.number().min(0, 'Le giornate non possono essere negative').max(99999),
})

const schema = z.object({ righe: z.array(rigaSchema) })

const select = {
  id: true,
  tipoAttivitaId: true,
  descrizione: true,
  giorni: true,
  ordine: true,
} as const

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    const righe = await prisma.progettoStimaDettaglio.findMany({
      where: { progettoId: parseInt(id) },
      orderBy: [{ ordine: 'asc' }, { id: 'asc' }],
      select,
    })
    return NextResponse.json(righe)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// Salva l'intero elenco: sostituisce le righe esistenti con quelle inviate
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const progettoId = parseInt(id)
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const progetto = await prisma.progetto.findUnique({ where: { id: progettoId }, select: { id: true } })
    if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

    const righe = await prisma.$transaction(async (tx) => {
      await tx.progettoStimaDettaglio.deleteMany({ where: { progettoId } })
      await tx.progettoStimaDettaglio.createMany({
        data: parsed.data.righe.map((r, i) => ({
          progettoId,
          tipoAttivitaId: r.tipoAttivitaId,
          descrizione: r.descrizione ?? null,
          giorni: r.giorni,
          ordine: i,
        })),
      })
      return tx.progettoStimaDettaglio.findMany({
        where: { progettoId },
        orderBy: [{ ordine: 'asc' }, { id: 'asc' }],
        select,
      })
    })
    return NextResponse.json(righe)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
