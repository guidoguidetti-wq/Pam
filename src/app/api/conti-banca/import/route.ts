import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { extractEntiBatch, normalizeEnte, parseItalianDate } from '@/lib/ente-extractor'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const banca = (formData.get('banca') as string | null)?.trim()

    if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 422 })
    if (!banca) return NextResponse.json({ error: 'Nome banca mancante' }, { status: 422 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const numeroConto = String(rows[9]?.[2] ?? '').trim()
    const iban = String(rows[10]?.[2] ?? '').trim()
    const intestatario = String(rows[11]?.[2] ?? '').trim()

    if (!numeroConto) return NextResponse.json({ error: 'Numero conto non trovato nel file' }, { status: 422 })

    let conto = await prisma.contoBanca.findFirst({ where: { numeroConto } })
    if (!conto) {
      conto = await prisma.contoBanca.create({
        data: { banca, numeroConto, iban: iban || null, intestatario: intestatario || null },
      })
    }

    const headerIdx = rows.findIndex(r => r[1] === 'Data operazione')
    if (headerIdx === -1) return NextResponse.json({ error: 'Intestazione colonne non trovata' }, { status: 422 })

    // Collect valid data rows first
    type RawRow = {
      dateStr: string
      valutaStr: string | null
      desc: string
      importo: number
      categoria: string | null
      stato: string | null
    }
    const validRows: RawRow[] = []

    for (const row of rows.slice(headerIdx + 1)) {
      const dateStr = row[1]
      const desc = row[3]
      if (!dateStr || !desc || typeof desc !== 'string') continue
      if (String(desc).trim() === 'Totale') continue
      const dataOp = parseItalianDate(String(dateStr))
      if (!dataOp) continue
      const entrate = typeof row[4] === 'number' ? row[4] : null
      const uscite = typeof row[5] === 'number' ? row[5] : null
      validRows.push({
        dateStr: String(dateStr),
        valutaStr: row[2] != null ? String(row[2]) : null,
        desc: String(desc),
        importo: (entrate ?? 0) + (uscite ?? 0),
        categoria: row[6] ? String(row[6]).trim() : null,
        stato: row[7] ? String(row[7]).trim() : null,
      })
    }

    // AI batch extraction of ente names
    const descriptions = validRows.map(r => r.desc)
    const enteNames = await extractEntiBatch(descriptions)

    let imported = 0
    let skipped = 0

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const dataOp = parseItalianDate(row.dateStr)!
      const dataVal = parseItalianDate(row.valutaStr)

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
          dataValuta: dataVal ?? null,
          descrizione: row.desc,
          enteId: ente.id,
          importo: row.importo,
          categoria: row.categoria,
          stato: row.stato,
          hash,
        },
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, contoId: Number(conto.id) })
  } catch (err) {
    console.error('[import-banca]', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
