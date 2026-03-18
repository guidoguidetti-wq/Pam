import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const stimaSchema = z.object({
  tipoAttivitaId: z.number().int().positive(),
  giorniStimati: z.coerce.number().positive(),
  orePerGiorno: z.coerce.number().positive().default(8),
})

const schema = z.object({
  committenteId: z.number().int().positive(),
  clienteId: z.number().int().positive(),
  codice: z.string().max(50).nullable().optional(),
  nome: z.string().trim().min(1).max(200),
  descrizione: z.string().nullable().optional(),
  tipoBudget: z.enum(['STIMATO', 'CONSUNTIVO']).default('CONSUNTIVO'),
  dataInizio: z.string().nullable().optional(),
  dataFinePrevista: z.string().nullable().optional(),
  attivo: z.boolean().default(true),
  note: z.string().nullable().optional(),
  stime: z.array(stimaSchema).default([]),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { stime, dataInizio, dataFinePrevista, ...rest } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.progettoStima.deleteMany({ where: { progettoId: parseInt(id) } })
      return tx.progetto.update({
        where: { id: parseInt(id) },
        data: {
          ...rest,
          dataInizio: dataInizio ? new Date(dataInizio) : null,
          dataFinePrevista: dataFinePrevista ? new Date(dataFinePrevista) : null,
          stime: stime.length > 0 ? {
            create: stime.map(s => ({
              tipoAttivitaId: s.tipoAttivitaId,
              giorniStimati: s.giorniStimati,
              orePerGiorno: s.orePerGiorno,
            })),
          } : undefined,
        },
        include: {
          committente: { select: { id: true, ragioneSociale: true } },
          cliente: { select: { id: true, ragioneSociale: true } },
          stime: {
            include: { tipoAttivita: { select: { id: true, codice: true, descrizione: true } } },
            orderBy: { tipoAttivitaId: 'asc' },
          },
          _count: { select: { attivita: true } },
        },
      })
    })
    return NextResponse.json(result)
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
      include: { _count: { select: { attivita: true } } },
    })
    if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
    if (progetto._count.attivita > 0)
      return NextResponse.json(
        { error: 'Impossibile eliminare: il progetto ha attività collegate' },
        { status: 409 }
      )

    await prisma.progetto.delete({ where: { id: parseInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
