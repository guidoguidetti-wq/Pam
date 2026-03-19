import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  committenteId: z.coerce.number().int().positive(),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  tipoAttivitaId: z.coerce.number().int().positive().nullable().optional(),
  tipoVoce: z.enum(['ORARIO', 'GIORNALIERO']),
  tariffa: z.coerce.number().positive('Tariffa obbligatoria'),
  tariffaKm: z.coerce.number().positive().nullable().optional(),
  valuta: z.string().length(3).default('EUR'),
  oreGiornata: z.coerce.number().positive().default(8),
  dataInizio: z.string().min(1, 'Data inizio obbligatoria'),
  dataFine: z.string().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = searchParams.get('committente_id')

  const listino = await prisma.listino.findMany({
    where: committenteId ? { committenteId: parseInt(committenteId) } : undefined,
    orderBy: [{ committenteId: 'asc' }, { clienteId: 'asc' }, { tipoAttivitaId: 'asc' }],
    include: {
      committente: { select: { id: true, ragioneSociale: true } },
      cliente: { select: { id: true, ragioneSociale: true } },
      tipoAttivita: { select: { id: true, codice: true, descrizione: true } },
    },
  })
  return NextResponse.json(listino)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { dataInizio, dataFine, ...rest } = parsed.data

  try {
    const result = await prisma.listino.create({
      data: {
        ...rest,
        tariffaKm: rest.tariffaKm ?? null,
        dataInizio: new Date(dataInizio),
        dataFine: dataFine ? new Date(dataFine) : null,
      },
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        cliente: { select: { id: true, ragioneSociale: true } },
        tipoAttivita: { select: { id: true, codice: true, descrizione: true } },
      },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
