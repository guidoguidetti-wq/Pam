import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { credenzialeSchema, credenzialeInclude } from '@/lib/credenziali'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const credenzialeId = parseInt(id)
  const body = await req.json()
  const parsed = credenzialeSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dati non validi', details: parsed.error.issues }, { status: 422 })

  const { voci, ...rest } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const esistenti = await tx.credenzialeVoce.findMany({
        where: { credenzialeId },
        select: { id: true },
      })
      const idEsistenti = new Set(esistenti.map(v => v.id))
      const idMantenuti = voci.flatMap(v => (v.id && idEsistenti.has(v.id) ? [v.id] : []))

      // Voci rimosse dal form
      await tx.credenzialeVoce.deleteMany({
        where: { credenzialeId, id: { notIn: idMantenuti } },
      })

      for (const [i, v] of voci.entries()) {
        const data = { descrizione: v.descrizione ?? null, utente: v.utente ?? null, password: v.password ?? null, ordine: i }
        if (v.id && idEsistenti.has(v.id)) {
          await tx.credenzialeVoce.update({ where: { id: v.id }, data })
        } else {
          await tx.credenzialeVoce.create({ data: { ...data, credenzialeId } })
        }
      }

      return tx.credenziale.update({
        where: { id: credenzialeId },
        data: rest,
        include: credenzialeInclude,
      })
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
    await prisma.credenziale.delete({ where: { id: parseInt(id) } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
