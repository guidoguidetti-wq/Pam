import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const da = searchParams.get('da')
  const a = searchParams.get('a')
  const enteId = searchParams.get('enteId')
  const contoId = searchParams.get('contoId')
  const tipo = searchParams.get('tipo') // 'entrate' | 'uscite' | ''

  try {
    const where: Record<string, unknown> = {}
    if (da || a) {
      where.dataOperazione = {
        ...(da ? { gte: new Date(da) } : {}),
        ...(a ? { lte: new Date(a) } : {}),
      }
    }
    if (enteId) where.enteId = parseInt(enteId)
    if (contoId) where.contoId = parseInt(contoId)
    if (tipo === 'entrate') where.importo = { gt: 0 }
    if (tipo === 'uscite') where.importo = { lt: 0 }

    const movimenti = await prisma.movimentoBancario.findMany({
      where,
      include: {
        ente: { select: { id: true, nome: true } },
        conto: { select: { id: true, banca: true, numeroConto: true } },
      },
      orderBy: [{ dataOperazione: 'desc' }, { id: 'desc' }],
      take: 1000,
    })

    const serialized = movimenti.map(m => ({
      ...m,
      id: Number(m.id),
      importo: Number(m.importo),
      dataOperazione: m.dataOperazione.toISOString().slice(0, 10),
      dataValuta: m.dataValuta ? m.dataValuta.toISOString().slice(0, 10) : null,
    }))

    return NextResponse.json(serialized)
  } catch (err) {
    console.error('[movimenti-banca]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
