import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  committenteId: z.coerce.number().int().positive(),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  tipoAttivitaId: z.coerce.number().int().positive().nullable().optional(),
  tipoVoce: z.enum(['ORARIO', 'GIORNALIERO', 'KM', 'RIMBORSO']),
  tariffa: z.coerce.number().positive(),
  valuta: z.string().length(3).default('EUR'),
  oreGiornata: z.coerce.number().positive().default(8),
  dataInizio: z.string().min(1),
  dataFine: z.string().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { dataInizio, dataFine, ...rest } = parsed.data

  try {
    const result = await prisma.listino.update({
      where: { id: parseInt(id) },
      data: {
        ...rest,
        dataInizio: new Date(dataInizio),
        dataFine: dataFine ? new Date(dataFine) : null,
      },
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        cliente: { select: { id: true, ragioneSociale: true } },
        tipoAttivita: { select: { id: true, codice: true, descrizione: true } },
      },
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
    await prisma.listino.delete({ where: { id: parseInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
