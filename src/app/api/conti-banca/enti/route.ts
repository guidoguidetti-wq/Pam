import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const enti = await prisma.ente.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, categoria: true, _count: { select: { movimenti: true } } },
    })
    return NextResponse.json(enti)
  } catch (err) {
    console.error('[enti]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

const updateSchema = z.object({ nome: z.string().min(1).max(200), categoria: z.string().max(100).optional().nullable() })

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id = parseInt(searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 422 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })

  try {
    const ente = await prisma.ente.update({
      where: { id },
      data: { nome: parsed.data.nome, nomeNorm: parsed.data.nome.toUpperCase().trim(), categoria: parsed.data.categoria ?? null },
    })
    return NextResponse.json(ente)
  } catch (err) {
    console.error('[enti-put]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
