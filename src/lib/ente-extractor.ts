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
  const bonificoMatch = desc.match(/(?:BONIFICO(?:\s+ISTANTANEO)?|EMOLUMENTI)\s+o\/c:\s+(.+?)\s{2,}/i)
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

// Regole deterministiche applicate PRIMA dell'AI — restituisce il nome ente o null se l'AI deve gestirlo
export function preProcessDescription(desc: string): string | null {
  // Raggruppamenti fissi (un unico ente per tutte le occorrenze)
  if (/^COMMISSIONI BONIFICI/i.test(desc)) return 'Commissioni Bonifici'
  if (/^IMPOSTA DI BOLLO/i.test(desc)) return 'Imposta di Bollo'
  if (/^PAGAM\.\s*DELEGA\s*F24/i.test(desc)) return 'F24 Agenzia Entrate'
  if (/^PAGAMENTO PAGOPA/i.test(desc)) return 'PagoPA'
  if (/^PENSIONE\s+PENSIONE\s+INPS/i.test(desc)) return 'INPS Pensione'
  if (/^SPESE\s+SU\s+PRELIEVO\s+ATM/i.test(desc)) return 'Spese Prelievo ATM'
  if (/^COMPETENZE\s+SPESE\s+ED\s+ONERI/i.test(desc)) return 'Competenze Spese ed Oneri'
  if (/^COMMISSIONE\s+TELEPASS/i.test(desc)) return 'Telepass'
  if (/^PEDAGGIO\s+AUTOSTRADE/i.test(desc)) return 'Telepass'

  // "DISPOSIZIONE a favore di NOME EUR importo..." — ferma a EUR (bug fix: prima si fermava a $)
  const dispMatch = desc.match(/^DISPOSIZIONE\s+a\s+favore\s+di\s+(.+?)\s+EUR\b/i)
  if (dispMatch) return dispMatch[1].trim()

  // "BONIFICO ISTANTANEO o/c: NOME  ABI-CAB:..."
  const bonInstMatch = desc.match(/^BONIFICO\s+ISTANTANEO\s+o\/c:\s+(.+?)\s{2,}/i)
  if (bonInstMatch) return bonInstMatch[1].trim()

  // Movimenti carta di credito: il commerciante è seguito da un ID transazione
  // casuale (e spesso l'indirizzo) che varia ad ogni acquisto — va scartato
  // per evitare un ente diverso per ogni singola transazione.
  if (/^(AMZN\s+Mktp|Amazon\.it\*|AMAZON\*|WWW\.AMAZON\.\*)/i.test(desc)) return 'Amazon'
  if (/^Amazon\s+Prime\b/i.test(desc)) return 'Amazon Prime'
  if (/^Kindle\s+Svcs/i.test(desc)) return 'Amazon Kindle'
  if (/^Ad\s+free\s+for\s+PrimeVideo/i.test(desc)) return 'Amazon Prime Video'
  if (/^(CLAUDE\.AI\s+SUBSCRIPTION|ANTHROPIC\*)/i.test(desc)) return 'Anthropic Claude'

  // "PAYPAL *MERCHANT indirizzo…" — tiene solo il nome del commerciante
  const paypalMatch = desc.match(/^PAYPAL\s+\*([A-Z0-9&.' -]+?)(?:\s+(?:Via|Viale|Corso|Piazza|Piazzale|Strada)\s|\s+\d|$)/i)
  if (paypalMatch) return paypalMatch[1].trim()

  return null
}

// AI batch extractor — sends up to 50 descriptions per call
export async function extractEntiBatch(descriptions: string[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // Apply deterministic pre-processing first
  const preProcessed = descriptions.map(d => preProcessDescription(d))

  // Collect only descriptions that need AI (pre-processing returned null)
  const needsAI: { idx: number; desc: string }[] = []
  preProcessed.forEach((result, idx) => {
    if (result === null) needsAI.push({ idx, desc: descriptions[idx] })
  })

  // If no API key or nothing needs AI, use regex fallback for remaining
  const aiResults: Record<number, string> = {}
  if (!apiKey || needsAI.length === 0) {
    needsAI.forEach(({ idx, desc }) => { aiResults[idx] = extractEnteRegex(desc) })
  } else {
    const client = new Anthropic({ apiKey })
    const BATCH = 50

    for (let i = 0; i < needsAI.length; i += BATCH) {
      const chunk = needsAI.slice(i, i + BATCH)
      const numbered = chunk.map((item, j) => `${j + 1}. ${item.desc}`).join('\n')

      try {
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
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('no JSON array found')
        const parsed: string[] = JSON.parse(jsonMatch[0])
        if (parsed.length !== chunk.length) throw new Error('length mismatch')

        chunk.forEach((item, j) => {
          aiResults[item.idx] = (parsed[j] ?? '').trim() || extractEnteRegex(item.desc)
        })
      } catch {
        chunk.forEach(({ idx, desc }) => { aiResults[idx] = extractEnteRegex(desc) })
      }
    }
  }

  // Merge pre-processed + AI results
  return descriptions.map((desc, idx) => preProcessed[idx] ?? aiResults[idx] ?? extractEnteRegex(desc))
}
