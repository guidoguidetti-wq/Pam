import Anthropic from '@anthropic-ai/sdk'

const MESI: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
}

export function parseItalianDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const clean = s.toString().trim()
  if (!clean || clean === '-' || clean === '"-"') return null
  const m = clean.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (!m) return null
  const month = MESI[m[2].toLowerCase()]
  if (month === undefined) return null
  return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1])))
}

// Fallback regex-based extractor (used when no API key)
export function extractEnteRegex(descrizione: string): string {
  const desc = descrizione.trim()
  if (/^Prelievo atm/i.test(desc)) return 'PRELIEVO ATM'
  if (/^PAGAMENTO CARTA DI CREDITO/i.test(desc)) return 'PAGAMENTO CARTA DI CREDITO'
  if (/^CANONE\s/i.test(desc)) {
    const m = desc.match(/^CANONE\s+SERVIZIO\s+(.+?)(?:\s{2,}|\s+-\s+UTENTE)/i)
    return m ? 'CANONE ' + m[1].trim() : desc.substring(0, 50)
  }
  const bonificoMatch = desc.match(/(?:BONIFICO|EMOLUMENTI)\s+o\/c:\s+(.+?)\s{2,}/i)
  if (bonificoMatch) return bonificoMatch[1].trim()
  const addebitoMatch = desc.match(/^(?:ADDEBITO SDD|COMMISSIONI)\s+(.+?)\s{2,}/i)
  if (addebitoMatch) return addebitoMatch[1].trim()
  const cleaned = desc.replace(/^Sum\*/, '')
  const itaIdx = cleaned.search(/\s+ITA\s/i)
  if (itaIdx !== -1) {
    const beforeIta = cleaned.substring(0, itaIdx)
    const parts = beforeIta.split(' ').filter(Boolean)
    let cut = parts.length
    if (cut > 0 && /^\d{5}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && cut < parts.length) return parts.slice(0, cut).join(' ')
    return beforeIta
  }
  const opIdx = cleaned.search(/\s+Operazione\s+[Cc]arta/i)
  if (opIdx !== -1) {
    const beforeOp = cleaned.substring(0, opIdx)
    const parts = beforeOp.split(' ').filter(Boolean)
    let cut = parts.length
    if (cut > 0 && /^[A-Z]{2}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && cut < parts.length) return parts.slice(0, cut).join(' ')
    return beforeOp
  }
  return cleaned.substring(0, 80).trim()
}

export function normalizeEnte(nome: string): string {
  return nome.toUpperCase().replace(/\s+/g, ' ').trim()
}

// AI batch extractor — sends up to 50 descriptions per call
export async function extractEntiBatch(descriptions: string[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return descriptions.map(extractEnteRegex)
  }

  const client = new Anthropic({ apiKey })
  const BATCH = 50
  const results: string[] = []

  for (let i = 0; i < descriptions.length; i += BATCH) {
    const chunk = descriptions.slice(i, i + BATCH)
    const numbered = chunk.map((d, idx) => `${idx + 1}. ${d}`).join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Sei un parser di movimenti bancari italiani. Per ogni descrizione qui sotto, estrai SOLO il nome del beneficiario/commerciante/ente.

Regole:
- Restituisci SOLO il nome (no città, no date, no numeri carta, no importi, no "Operazione carta", no "ITA")
- Pagamenti carta "VODAFONE MODENA ITA Operazione carta..." → "Vodafone"
- Bonifici "BONIFICO o/c: SOFTINTIME S.R.L. ABI-CAB:..." → "Softintime S.r.l."
- Addebiti SDD "ADDEBITO SDD FASTWEB S.p.A. N:..." → "Fastweb S.p.A."
- Commissioni "COMMISSIONI PayPal Europe..." → "PayPal"
- Prelievi ATM → "Prelievo ATM"
- Pagamenti carta credito "PAGAMENTO CARTA DI CREDITO..." → "Pagamento Carta di Credito"
- Canoni "CANONE SERVIZIO MULTICANALITA'..." → "Canone Multicanalità"
- Usa la capitalizzazione corretta (non tutto maiuscolo)
- Abbreviazioni legali: S.r.l., S.p.A., S.n.c., ecc.

Rispondi con un array JSON di stringhe, uno per descrizione, nell'ESATTO stesso ordine. Nient'altro.

Descrizioni:
${numbered}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('no JSON array found')
      const parsed: string[] = JSON.parse(jsonMatch[0])
      if (parsed.length !== chunk.length) throw new Error('length mismatch')
      results.push(...parsed.map(n => (n ?? '').trim() || extractEnteRegex(chunk[parsed.indexOf(n)])))
    } catch {
      // Fallback to regex for this chunk
      results.push(...chunk.map(extractEnteRegex))
    }
  }

  return results
}
