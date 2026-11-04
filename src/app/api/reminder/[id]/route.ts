import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const idSchema = z.coerce.number().int().positive()

const updateSchema = z.object({
  testo: z.string().trim().min(1, 'Testo obbligatorio').max(5000),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const parsedId = idSchema.safeParse((await params).id)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'ID non valido', details: parsedId.error.issues }, { status: 422 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })
  }

  try {
    const esistente = await prisma.reminder.findUnique({ where: { id: parsedId.data }, select: { id: true } })
    if (!esistente) return NextResponse.json({ error: 'Reminder non trovato' }, { status: 404 })

    const reminder = await prisma.reminder.update({
      where: { id: parsedId.data },
      data: { testo: parsed.data.testo },
    })
    return NextResponse.json(reminder)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const parsed = idSchema.safeParse((await params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: 'ID non valido', details: parsed.error.issues }, { status: 422 })
  }

  try {
    await prisma.reminder.delete({ where: { id: parsed.data } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
