import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PrioritaTodo, StatoTodo } from '@prisma/client'

const updateSchema = z.object({
  titolo: z.string().min(1).max(300).optional(),
  descrizione: z.string().optional().nullable(),
  priorita: z.nativeEnum(PrioritaTodo).optional(),
  stato: z.nativeEnum(StatoTodo).optional(),
  committenteId: z.number().int().positive().optional().nullable(),
  clienteId: z.number().int().positive().optional().nullable(),
  committenteLibero: z.string().max(200).optional().nullable(),
  clienteLibero: z.string().max(200).optional().nullable(),
  scadenza: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

function serializeTodo(t: {
  id: bigint
  titolo: string
  descrizione: string | null
  priorita: PrioritaTodo
  stato: StatoTodo
  committenteId: number | null
  clienteId: number | null
  committenteLibero: string | null
  clienteLibero: string | null
  scadenza: Date | null
  note: string | null
  createdAt: Date
  updatedAt: Date
  committente: { id: number; ragioneSociale: string } | null
  cliente: { id: number; ragioneSociale: string } | null
}) {
  return {
    ...t,
    id: t.id.toString(),
    scadenza: t.scadenza ? t.scadenza.toISOString().split('T')[0] : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })
  }

  const { scadenza, ...rest } = parsed.data

  try {
    const todo = await prisma.todo.update({
      where: { id: BigInt(id) },
      data: {
        ...rest,
        ...(scadenza !== undefined ? { scadenza: scadenza ? new Date(scadenza) : null } : {}),
      },
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        cliente: { select: { id: true, ragioneSociale: true } },
      },
    })

    return NextResponse.json(serializeTodo(todo))
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
    await prisma.todo.delete({ where: { id: BigInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
