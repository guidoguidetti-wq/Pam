import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  codice: z.string().trim().min(1).max(10).transform((v) => v.toUpperCase()),
  descrizione: z.string().trim().min(1).max(100),
  attivo: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const tipi = await prisma.tipoAttivita.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json(tipi)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.tipoAttivita.create({ data: parsed.data })
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002')
      return NextResponse.json({ error: 'Codice già esistente' }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
