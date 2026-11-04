import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const idSchema = z.coerce.number().int().positive()

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
