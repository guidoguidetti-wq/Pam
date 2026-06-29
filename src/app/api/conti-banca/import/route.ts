import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { extractEnte, normalizeEnte, parseItalianDate } from '@/lib/ente-extractor'
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

    // Extract account header (rows 8–11, col index 1–2)
    const numeroConto = String(rows[9]?.[2] ?? '').trim()
    const iban = String(rows[10]?.[2] ?? '').trim()
    const intestatario = String(rows[11]?.[2] ?? '').trim()

    if (!numeroConto) return NextResponse.json({ error: 'Numero conto non trovato nel file' }, { status: 422 })

    // Find or create ContoBanca
    let conto = await prisma.contoBanca.findFirst({ where: { iban: iban || undefined, numeroConto } })
    if (!conto) {
      conto = await prisma.contoBanca.create({
        data: { banca, numeroConto, iban: iban || null, intestatario: intestatario || null },
      })
    }

    // Find header row (where col[1] === 'Data operazione')
    const headerIdx = rows.findIndex(r => r[1] === 'Data operazione')
    if (headerIdx === -1) return NextResponse.json({ error: 'Intestazione colonne non trovata' }, { status: 422 })

    const dataRows = rows.slice(headerIdx + 1)

    let imported = 0
    let skipped = 0

    for (const row of dataRows) {
      const dateStr = row[1]
      const valutaStr = row[2]
      const desc = row[3]
      const entrate = typeof row[4] === 'number' ? row[4] : null
      const uscite = typeof row[5] === 'number' ? row[5] : null
      const categoria = row[6] ? String(row[6]).trim() : null
      const stato = row[7] ? String(row[7]).trim() : null

      if (!dateStr || !desc || typeof desc !== 'string') continue
      if (String(desc).trim() === 'Totale') continue

      const dataOp = parseItalianDate(String(dateStr))
      if (!dataOp) continue

      const dataVal = parseItalianDate(valutaStr != null ? String(valutaStr) : null)
      const importo = (entrate ?? 0) + (uscite ?? 0)

      // Hash per deduplicazione
      const hashInput = `${conto.id}|${dataOp.toISOString().slice(0, 10)}|${String(desc).substring(0, 255)}|${importo}`
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 64)

      const exists = await prisma.movimentoBancario.findUnique({
        where: { contoId_hash: { contoId: conto.id, hash } },
      })
      if (exists) { skipped++; continue }

      // Trova/crea ente
      const nomeEnte = extractEnte(String(desc))
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
          descrizione: String(desc),
          enteId: ente.id,
          importo,
          categoria,
          stato,
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
