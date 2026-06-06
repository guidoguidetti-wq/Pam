import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PrioritaTodo, StatoTodo } from '@prisma/client'

const createSchema = z.object({
  titolo: z.string().min(1).max(300),
  descrizione: z.string().optional().nullable(),
  priorita: z.nativeEnum(PrioritaTodo).default('MEDIA'),
  stato: z.nativeEnum(StatoTodo).default('APERTA'),
  committenteId: z.number().int().positive().optional().nullable(),
  clienteId: z.number().int().positive().optional().nullable(),
  committenteLibero: z.string().max(200).optional().nullable(),
  clienteLibero: z.string().max(200).optional().nullable(),
  scadenza: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stato = searchParams.get('stato') as StatoTodo | null
  const priorita = searchParams.get('priorita') as PrioritaTodo | null
  const committenteId = searchParams.get('committenteId')

  try {
    const todos = await prisma.todo.findMany({
      where: {
        ...(stato ? { stato } : {}),
        ...(priorita ? { priorita } : {}),
        ...(committenteId ? { committenteId: parseInt(committenteId) } : {}),
      },
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        cliente: { select: { id: true, ragioneSociale: true } },
      },
      orderBy: [
        { stato: 'asc' },
        { priorita: 'asc' },
        { scadenza: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(
      todos.map((t) => ({
        ...t,
        id: t.id.toString(),
        scadenza: t.scadenza ? t.scadenza.toISOString().split('T')[0] : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })
  }

  const { scadenza, ...rest } = parsed.data

  try {
    const todo = await prisma.todo.create({
      data: {
        ...rest,
        scadenza: scadenza ? new Date(scadenza) : null,
      },
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        cliente: { select: { id: true, ragioneSociale: true } },
      },
    })

    return NextResponse.json(
      {
        ...todo,
        id: todo.id.toString(),
        scadenza: todo.scadenza ? todo.scadenza.toISOString().split('T')[0] : null,
        createdAt: todo.createdAt.toISOString(),
        updatedAt: todo.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
