import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  codice: z.string().trim().min(1).max(10).transform((v) => v.toUpperCase()),
  descrizione: z.string().trim().min(1).max(100),
  attivo: z.boolean().default(true),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const result = await prisma.tipoAttivita.update({ where: { id: parseInt(id) }, data: parsed.data })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002')
      return NextResponse.json({ error: 'Codice già esistente' }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.tipoAttivita.delete({ where: { id: parseInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code === 'P2003' || code === 'P2014')
      return NextResponse.json({ error: 'Tipo in uso, impossibile eliminare' }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
