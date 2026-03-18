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
  committenteId: z.number().int().positive(),
  ragioneSociale: z.string().trim().min(1, 'Obbligatorio').max(200),
  partitaIva: ns(20),
  indirizzo: ns(),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().email('Email non valida').nullable().optional()
  ),
  note: ns(),
  attivo: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const committenteId = searchParams.get('committente_id')

  const clienti = await prisma.cliente.findMany({
    where: committenteId ? { committenteId: parseInt(committenteId) } : undefined,
    orderBy: [{ committente: { ragioneSociale: 'asc' } }, { ragioneSociale: 'asc' }],
    include: {
      committente: { select: { id: true, ragioneSociale: true } },
      _count: { select: { attivita: true } },
    },
  })
  return NextResponse.json(clienti)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.cliente.create({ data: parsed.data })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
