import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

const PRIMARY = 'FF1F3A5F'
const LIGHT = 'FFEEF3FB'
const BORDER = 'FFD1D5DB'

const bordo: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER } },
  bottom: { style: 'thin', color: { argb: BORDER } },
  left: { style: 'thin', color: { argb: BORDER } },
  right: { style: 'thin', color: { argb: BORDER } },
}

function stileIntestazione(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } }
    cell.alignment = { vertical: 'middle' }
    cell.border = bordo
  })
  row.height = 20
}

function stileTotale(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
    cell.border = bordo
  })
}

// Export Excel formattato del dettaglio stime (dati salvati)
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await params
  const progettoId = parseInt(id)

  try {
    const progetto = await prisma.progetto.findUnique({
      where: { id: progettoId },
      select: {
        nome: true,
        codice: true,
        stimeNote: true,
        committente: { select: { ragioneSociale: true } },
        cliente: { select: { ragioneSociale: true } },
        stimeDettaglio: {
          orderBy: [{ ordine: 'asc' }, { id: 'asc' }],
          select: {
            descrizione: true,
            giorni: true,
            inviata: true,
            accettata: true,
            tipoAttivita: { select: { id: true, codice: true, descrizione: true } },
          },
        },
      },
    })
    if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'PAM'
    wb.created = new Date()
    const ws = wb.addWorksheet('Stime', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ showGridLines: false }],
    })
    ws.columns = [
      { key: 'codice', width: 10 },
      { key: 'tipo', width: 26 },
      { key: 'descrizione', width: 60 },
      { key: 'giorni', width: 12 },
      { key: 'inviata', width: 10 },
      { key: 'accettata', width: 11 },
    ]

    // Intestazione documento
    const titolo = ws.addRow([`Stima — ${progetto.codice ? `[${progetto.codice}] ` : ''}${progetto.nome}`])
    ws.mergeCells(titolo.number, 1, titolo.number, 6)
    titolo.font = { bold: true, size: 14, color: { argb: PRIMARY } }
    titolo.height = 22

    const info: [string, string][] = [
      ['Committente', progetto.committente.ragioneSociale],
      ['Cliente', progetto.cliente.ragioneSociale],
      ['Data', new Date().toLocaleDateString('it-IT')],
    ]
    for (const [k, v] of info) {
      const r = ws.addRow([k, v])
      ws.mergeCells(r.number, 2, r.number, 6)
      r.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
    }
    if (progetto.stimeNote) {
      const r = ws.addRow(['Note', progetto.stimeNote])
      ws.mergeCells(r.number, 2, r.number, 6)
      r.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } }
      r.getCell(1).alignment = { vertical: 'top' }
      r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
      r.height = Math.min(15 * Math.ceil(progetto.stimeNote.length / 90 + (progetto.stimeNote.match(/\n/g)?.length ?? 0)), 300)
    }
    ws.addRow([])

    // Tabella dettaglio
    stileIntestazione(ws.addRow(['Codice', 'Tipo attività', 'Descrizione', 'Giornate', 'Inviata', 'Accettata']))
    ws.getRow(ws.rowCount).getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getRow(ws.rowCount).getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(ws.rowCount).getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
    const primaRiga = ws.rowCount + 1
    for (const [i, r] of progetto.stimeDettaglio.entries()) {
      const row = ws.addRow([
        r.tipoAttivita.codice,
        r.tipoAttivita.descrizione,
        r.descrizione ?? '',
        r.giorni.toNumber() === 0 ? null : r.giorni.toNumber(),
        r.inviata ? 'Sì' : 'No',
        r.accettata ? 'Sì' : 'No',
      ])
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = bordo
        cell.alignment = { vertical: 'top', wrapText: true }
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      })
      row.getCell(4).numFmt = '#,##0.00'
      row.getCell(4).alignment = { vertical: 'top', horizontal: 'right' }
      // Riga di nota (giornate 0)
      if (r.giorni.toNumber() === 0) row.getCell(3).font = { italic: true, color: { argb: 'FF6B7280' } }
      for (const [col, ok] of [[5, r.inviata], [6, r.accettata]] as const) {
        row.getCell(col).alignment = { vertical: 'top', horizontal: 'center' }
        row.getCell(col).font = { bold: ok, color: { argb: ok ? 'FF15803D' : 'FF9CA3AF' } }
      }
    }
    const ultimaRiga = ws.rowCount
    const totale = ws.addRow(['', '', 'Totale',
      progetto.stimeDettaglio.length > 0 ? { formula: `SUM(D${primaRiga}:D${ultimaRiga})` } : 0, '', ''])
    stileTotale(totale)
    totale.getCell(3).alignment = { horizontal: 'right' }
    totale.getCell(4).numFmt = '#,##0.00'

    // Riepilogo per tipo attività (formule, si aggiornano se si modifica il foglio)
    const tipi = [...new Map(progetto.stimeDettaglio.map(r => [r.tipoAttivita.id, r.tipoAttivita])).values()]
      .sort((a, b) => a.id - b.id)
    if (tipi.length > 0) {
      ws.addRow([])
      const t = ws.addRow(['Riepilogo per tipo attività'])
      t.font = { bold: true, color: { argb: PRIMARY } }
      stileIntestazione(ws.addRow(['Codice', 'Tipo attività', '% sul totale', 'Giornate']))
      const primaRiep = ws.rowCount + 1
      const ultimaRiep = primaRiep + tipi.length - 1
      for (const tipo of tipi) {
        const n = ws.rowCount + 1
        const row = ws.addRow([
          tipo.codice,
          tipo.descrizione,
          { formula: `IF(D${ultimaRiep + 1}=0,0,D${n}/D${ultimaRiep + 1})` },
          { formula: `SUMIF(A${primaRiga}:A${ultimaRiga},A${n},D${primaRiga}:D${ultimaRiga})` },
        ])
        row.eachCell(cell => { cell.border = bordo })
        row.getCell(3).numFmt = '0%'
        row.getCell(4).numFmt = '#,##0.00'
      }
      const tot = ws.addRow(['', '', 'Totale', { formula: `SUM(D${primaRiep}:D${ultimaRiep})` }])
      stileTotale(tot)
      tot.getCell(3).alignment = { horizontal: 'right' }
      tot.getCell(4).numFmt = '#,##0.00'
    }

    const buffer = await wb.xlsx.writeBuffer()
    const nomeFile = `stime-${(progetto.codice || progetto.nome).replace(/[^\w-]+/g, '_')}.xlsx`
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeFile}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Errore generazione Excel' }, { status: 500 })
  }
}
