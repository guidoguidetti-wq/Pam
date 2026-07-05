import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { extractEntiBatch, normalizeEnte, parseItalianDate } from '@/lib/ente-extractor'
import crypto from 'crypto'

const BANCA_CARTA = 'BPER Carta di Credito'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 422 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const panRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'Pan Carta'))
    if (panRowIdx === -1) return NextResponse.json({ error: 'Riga "Pan Carta" non trovata nel file' }, { status: 422 })
    const panCellIdx = rows[panRowIdx].findIndex(c => String(c).trim() === 'Pan Carta')
    const panValue = String(rows[panRowIdx][panCellIdx + 1] ?? '').trim()
    const panMatch = panValue.match(/(\d{4})\s*$/)
    if (!panMatch) return NextResponse.json({ error: 'Ultime 4 cifre carta non trovate' }, { status: 422 })
    const ultimeCifre = panMatch[1]

    const titolareRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'Titolare'))
    let intestatario: string | null = null
    if (titolareRowIdx !== -1) {
      const cellIdx = rows[titolareRowIdx].findIndex(c => String(c).trim() === 'Titolare')
      intestatario = String(rows[titolareRowIdx][cellIdx + 1] ?? '').trim() || null
    }

    const numeroConto = `CARTA ${ultimeCifre}`
    let conto = await prisma.contoBanca.findFirst({ where: { numeroConto } })
    if (!conto) {
      conto = await prisma.contoBanca.create({
        data: { banca: BANCA_CARTA, numeroConto, intestatario },
      })
    }

    const headerIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'Data operazione'))
    if (headerIdx === -1) return NextResponse.json({ error: 'Intestazione colonne non trovata' }, { status: 422 })
    const headerRow = rows[headerIdx]
    const idxData = headerRow.findIndex(h => String(h).trim() === 'Data operazione')
    const idxDesc = headerRow.findIndex(h => String(h).trim() === 'Descrizione')
    const idxImp = headerRow.findIndex(h => String(h).trim() === 'Importo €')
    const idxStato = headerRow.findIndex(h => String(h).trim() === 'Stato')

    type RawRow = { dateStr: string; desc: string; importo: number; stato: string | null }
    const validRows: RawRow[] = []

    for (const row of rows.slice(headerIdx + 1)) {
      const dateStr = row[idxData]
      const desc = row[idxDesc]
      const impRaw = row[idxImp]
      if (!dateStr || !desc || typeof desc !== 'string') continue
      if (/^PAGAMENTO CON ADDEBITO/i.test(desc.trim())) continue
      const dataOp = parseItalianDate(String(dateStr))
      if (!dataOp) continue
      const importo = typeof impRaw === 'number' ? impRaw : parseFloat(String(impRaw).replace(',', '.'))
      if (!Number.isFinite(importo)) continue
      validRows.push({
        dateStr: String(dateStr),
        desc: desc.trim(),
        importo,
        stato: row[idxStato] ? String(row[idxStato]).trim() : null,
      })
    }

    const categoria = `CARTA ${ultimeCifre}`
    const descriptions = validRows.map(r => r.desc)
    const enteNames = await extractEntiBatch(descriptions)

    let imported = 0
    let skipped = 0

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const dataOp = parseItalianDate(row.dateStr)!

      const hashInput = `${conto.id}|${dataOp.toISOString().slice(0, 10)}|${row.desc.substring(0, 255)}|${row.importo}`
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 64)

      const exists = await prisma.movimentoBancario.findUnique({
        where: { contoId_hash: { contoId: conto.id, hash } },
      })
      if (exists) { skipped++; continue }

      const nomeEnte = enteNames[i] || row.desc.substring(0, 80)
      const nomeNorm = normalizeEnte(nomeEnte)
      let ente = await prisma.ente.findUnique({ where: { nomeNorm } })
      if (!ente) {
        ente = await prisma.ente.create({ data: { nome: nomeEnte, nomeNorm } })
      }

      await prisma.movimentoBancario.create({
        data: {
          contoId: conto.id,
          dataOperazione: dataOp,
          dataValuta: null,
          descrizione: row.desc,
          enteId: ente.id,
          importo: row.importo,
          categoria,
          stato: row.stato,
          hash,
        },
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, contoId: Number(conto.id), ultimeCifre })
  } catch (err) {
    console.error('[import-carta]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
