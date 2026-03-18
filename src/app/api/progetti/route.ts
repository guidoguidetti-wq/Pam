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
  nome: z.string().trim().min(1, 'Nome obbligatorio').max(200),
  descrizione: z.string().nullable().optional(),
  tipoBudget: z.enum(['STIMATO', 'CONSUNTIVO']).default('CONSUNTIVO'),
  dataInizio: z.string().nullable().optional(),
  dataFinePrevista: z.string().nullable().optional(),
  attivo: z.boolean().default(true),
  note: z.string().nullable().optional(),
  stime: z.array(stimaSchema).default([]),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = searchParams.get('committente_id')
  const clienteId = searchParams.get('cliente_id')

  const progetti = await prisma.progetto.findMany({
    where: {
      ...(committenteId ? { committenteId: parseInt(committenteId) } : {}),
      ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
    },
    orderBy: [{ committente: { ragioneSociale: 'asc' } }, { nome: 'asc' }],
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
  return NextResponse.json(progetti)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { stime, dataInizio, dataFinePrevista, ...rest } = parsed.data

  try {
    const result = await prisma.progetto.create({
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
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
