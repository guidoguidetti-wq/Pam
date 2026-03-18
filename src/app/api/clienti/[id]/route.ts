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

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.cliente.update({
      where: { id: parseInt(id) },
      data: parsed.data,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.cliente.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2003' || e?.code === 'P2014') {
      return NextResponse.json(
        { error: 'Impossibile eliminare: esistono attività collegate' },
        { status: 409 }
      )
    }
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
