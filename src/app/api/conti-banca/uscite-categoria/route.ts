import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const NON_CATEGORIZZATO = 'Non categorizzato'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const da = searchParams.get('da')
  const a = searchParams.get('a')
  const contoId = searchParams.get('contoId')
  const enteId = searchParams.get('enteId')

  try {
    const where: Record<string, unknown> = { importo: { lt: 0 } }
    if (da || a) {
      where.dataOperazione = {
        ...(da ? { gte: new Date(da) } : {}),
        ...(a ? { lte: new Date(a) } : {}),
      }
    }
    if (contoId) where.contoId = parseInt(contoId)
    if (enteId) where.enteId = parseInt(enteId)

    const [movimenti, categorieEnti] = await Promise.all([
      prisma.movimentoBancario.findMany({
        where,
        select: { importo: true, ente: { select: { categoria: true } } },
      }),
      prisma.enteCategoria.findMany({ select: { categoria: true, inestratto: true, ingrafico: true } }),
    ])

    const flags = new Map(categorieEnti.map(c => [c.categoria, c]))

    const totali = new Map<string, number>()
    for (const m of movimenti) {
      const categoria = m.ente?.categoria ?? NON_CATEGORIZZATO
      const flag = flags.get(categoria)
      if (flag && (!flag.inestratto || !flag.ingrafico)) continue
      totali.set(categoria, (totali.get(categoria) ?? 0) + Math.abs(Number(m.importo)))
    }

    const result = Array.from(totali.entries())
      .map(([categoria, totale]) => ({ categoria, totale }))
      .sort((a, b) => b.totale - a.totale)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[uscite-categoria]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
