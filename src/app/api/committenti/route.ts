import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const ns = (max = 500) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().max(max).nullable().optional()
  )

const schema = z.object({
  ragioneSociale: z.string().trim().min(1, 'Obbligatorio').max(200),
  partitaIva: ns(20),
  codiceFiscale: ns(16),
  indirizzo: ns(),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().email('Email non valida').nullable().optional()
  ),
  telefono: ns(30),
  note: ns(),
  attivo: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const committenti = await prisma.committente.findMany({
    orderBy: { ragioneSociale: 'asc' },
    include: { _count: { select: { clienti: true } } },
  })
  return NextResponse.json(committenti)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.committente.create({ data: parsed.data })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
