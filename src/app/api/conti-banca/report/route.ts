import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { BancaReportDocument } from '@/components/conti-banca/BancaReportDocument'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const da = searchParams.get('da')
  const a = searchParams.get('a')
  const contoId = searchParams.get('contoId')
  const enteId = searchParams.get('enteId')
  const ordinamento = searchParams.get('ordinamento') ?? 'data' // 'data' | 'ente'

  if (!da || !a) return NextResponse.json({ error: 'Parametri da e a obbligatori' }, { status: 400 })

  try {
    const where: Record<string, unknown> = {
      dataOperazione: { gte: new Date(da), lte: new Date(a) },
    }
    if (contoId) where.contoId = parseInt(contoId)
    if (enteId) where.enteId = parseInt(enteId)

    const movimenti = await prisma.movimentoBancario.findMany({
      where,
      include: {
        ente: { select: { nome: true, categoria: true } },
        conto: { select: { banca: true, numeroConto: true } },
      },
      orderBy:
        ordinamento === 'ente'
          ? [{ ente: { nome: 'asc' } }, { dataOperazione: 'desc' }]
          : ordinamento === 'categoria'
          ? [{ ente: { categoria: 'asc' } }, { ente: { nome: 'asc' } }, { dataOperazione: 'desc' }]
          : [{ dataOperazione: 'desc' }],
    })

    const contiDistinti = [...new Map(movimenti.map(m => [m.contoId, m.conto])).values()]

    const buffer = await renderToBuffer(
      React.createElement(BancaReportDocument, {
        movimenti: movimenti.map(m => ({
          id: Number(m.id),
          dataOperazione: m.dataOperazione.toISOString().slice(0, 10),
          ente: m.ente?.nome ?? '—',
          categoriaEnte: m.ente?.categoria ?? '',
          descrizione: m.descrizione,
          importo: Number(m.importo),
          categoria: m.categoria ?? '',
          banca: m.conto.banca,
          numeroConto: m.conto.numeroConto,
        })),
        conti: contiDistinti.map(c => `${c.banca} - ${c.numeroConto}`),
        da,
        a,
        ordinamento,
      }) as React.ReactElement<DocumentProps>
    )

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="movimenti_${da}_${a}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[banca-report]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
