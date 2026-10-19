import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serializeAllegato } from '@/lib/allegati'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  descrizione: z.string().trim().max(2000).nullable().optional(),
  dataAllegato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { descrizione, dataAllegato } = parsed.data
  try {
    const allegato = await prisma.allegato.update({
      where: { id: BigInt(id) },
      data: {
        ...(descrizione !== undefined ? { descrizione: descrizione || null } : {}),
        ...(dataAllegato !== undefined ? { dataAllegato: dataAllegato ? new Date(dataAllegato) : null } : {}),
      },
    })
    return NextResponse.json(serializeAllegato(allegato))
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
    const allegato = await prisma.allegato.findUnique({ where: { id: BigInt(id) } })
    if (!allegato) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })

    if (allegato.storageUrl) {
      await del(allegato.storageUrl)
    }
    await prisma.allegato.delete({ where: { id: BigInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
