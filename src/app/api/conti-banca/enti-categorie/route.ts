import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const categorie = await prisma.enteCategoria.findMany({ orderBy: { categoria: 'asc' } })
    return NextResponse.json(categorie)
  } catch (err) {
    console.error('[enti-categorie]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

const createSchema = z.object({
  categoria: z.string().trim().min(1).max(100),
  inestratto: z.boolean().optional(),
  ingrafico: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const categoria = await prisma.enteCategoria.create({
      data: {
        categoria: parsed.data.categoria,
        inestratto: parsed.data.inestratto ?? true,
        ingrafico: parsed.data.ingrafico ?? true,
      },
    })
    return NextResponse.json(categoria, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Categoria già esistente' }, { status: 409 })
    }
    console.error('[enti-categorie-post]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

const updateSchema = z.object({
  categoria: z.string().trim().min(1).max(100).optional(),
  inestratto: z.boolean().optional(),
  ingrafico: z.boolean().optional(),
})

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id = parseInt(searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 422 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  try {
    const categoria = await prisma.enteCategoria.update({ where: { id }, data: parsed.data })
    return NextResponse.json(categoria)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Categoria già esistente' }, { status: 409 })
    }
    console.error('[enti-categorie-put]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id = parseInt(searchParams.get('id') ?? '')
  if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 422 })

  try {
    await prisma.enteCategoria.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[enti-categorie-delete]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
