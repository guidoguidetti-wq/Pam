import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const movimenti = await prisma.movimentoBancario.findMany({
      where: { importo: { gt: 0 } },
      select: { dataOperazione: true, descrizione: true, importo: true },
      orderBy: { dataOperazione: 'desc' },
    })

    const result = movimenti.map(m => ({
      dataOperazione: m.dataOperazione.toLocaleDateString('it-IT'),
      descrizione: m.descrizione,
      entrate: Number(m.importo),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[movimenti-entrate]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
