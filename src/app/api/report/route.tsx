import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReportDocument } from '@/components/report/ReportDocument'
import type { ReportCommittente, ReportCliente, ReportAttivita, ReportSpesa } from '@/components/report/ReportDocument'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const committenteIdParam = searchParams.get('committente_id')
  const includeSpese = searchParams.get('include_spese') === '1'

  if (!from || !to) {
    return NextResponse.json({ error: 'Parametri from e to obbligatori' }, { status: 400 })
  }

  try {
    const committenteFilter = committenteIdParam ? { id: parseInt(committenteIdParam) } : { attivo: true }

    const [committentiDb, attivitaDb] = await Promise.all([
      prisma.committente.findMany({
        where: committenteFilter,
        orderBy: { ragioneSociale: 'asc' },
        select: {
          id: true,
          ragioneSociale: true,
          partitaIva: true,
          indirizzo: true,
          email: true,
          telefono: true,
        },
      }),
      prisma.attivita.findMany({
        where: {
          dataAttivita: { gte: new Date(from), lte: new Date(to) },
          ...(committenteIdParam ? { committenteId: parseInt(committenteIdParam) } : {}),
        },
        include: {
          tipoAttivita: { select: { codice: true } },
          progetto: { select: { nome: true } },
          cliente: { select: { id: true, ragioneSociale: true } },
          spese: {
            include: {
              allegati: {
                select: {
                  nomeFile: true,
                  tipoMime: true,
                  storageUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ committenteId: 'asc' }, { clienteId: 'asc' }, { dataAttivita: 'asc' }, { oraInizio: 'asc' }],
      }),
    ])

    // Build ReportCommittente[] structure
    const committenteMap = new Map<number, ReportCommittente>()

    for (const c of committentiDb) {
      committenteMap.set(c.id, {
        id: c.id,
        ragioneSociale: c.ragioneSociale,
        partitaIva: c.partitaIva,
        indirizzo: c.indirizzo,
        email: c.email,
        telefono: c.telefono,
        clienti: [],
      })
    }

    // Group attivita by committente → cliente
    for (const a of attivitaDb) {
      const committente = committenteMap.get(a.committenteId)
      if (!committente) continue

      const clienteKey = a.clienteId ?? null
      const clienteNome = a.cliente?.ragioneSociale ?? 'Senza cliente'

      let cliente = committente.clienti.find(cl => cl.id === clienteKey)
      if (!cliente) {
        cliente = { id: clienteKey, ragioneSociale: clienteNome, attivita: [] }
        committente.clienti.push(cliente)
      }

      const spese: ReportSpesa[] = a.spese.map(s => ({
        tipoSpesa: s.tipoSpesa,
        descrizione: s.descrizione,
        quantita: s.quantita ? parseFloat(s.quantita.toString()) : null,
        importoUnitario: s.importoUnitario ? parseFloat(s.importoUnitario.toString()) : null,
        importoTotale: parseFloat(s.importoTotale.toString()),
        dataSpesa: s.dataSpesa.toISOString().split('T')[0],
        allegati: s.allegati.map(al => ({
          nomeFile: al.nomeFile,
          tipoMime: al.tipoMime,
          storageUrl: al.storageUrl,
        })),
      }))

      const oraInizio = a.oraInizio.toISOString().substring(11, 16)
      const oraFine = a.oraFine.toISOString().substring(11, 16)

      const attivita: ReportAttivita = {
        dataAttivita: a.dataAttivita.toISOString().split('T')[0],
        oraInizio,
        oraFine,
        oreErogate: a.oreErogate ?? (() => {
          const [hi, mi] = oraInizio.split(':').map(Number)
          const [hf, mf] = oraFine.split(':').map(Number)
          return (hf * 60 + mf) - (hi * 60 + mi)
        })(),
        tipoAttivita: a.tipoAttivita.codice,
        progetto: a.progetto?.nome ?? null,
        prezzoUnitario: a.prezzoUnitario ? parseFloat(a.prezzoUnitario.toString()) : null,
        valoreAttivita: a.valoreAttivita ? parseFloat(a.valoreAttivita.toString()) : null,
        fatturabile: a.fatturabile,
        hasSpese: a.spese.length > 0,
        spese,
      }

      cliente.attivita.push(attivita)
    }

    // Only include committenti that have activities
    const committenti = Array.from(committenteMap.values()).filter(c => c.clienti.length > 0)

    if (committenti.length === 0) {
      return NextResponse.json({ error: 'Nessuna attività nel periodo selezionato' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(ReportDocument, { committenti, from, to, includeSpese }) as any
    )

    const fromLabel = from.replace(/-/g, '')
    const toLabel = to.replace(/-/g, '')

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${fromLabel}-${toLabel}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[report] error:', err)
    return NextResponse.json({ error: 'Errore generazione report' }, { status: 500 })
  }
}
