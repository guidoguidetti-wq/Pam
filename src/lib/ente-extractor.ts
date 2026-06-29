const MESI: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
}

export function parseItalianDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const clean = s.toString().trim().replace(/^"-?"$/, '').replace(/^-$/, '')
  if (!clean || clean === '"-"') return null
  const m = clean.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (!m) return null
  const month = MESI[m[2].toLowerCase()]
  if (month === undefined) return null
  return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1])))
}

export function extractEnte(descrizione: string): string {
  const desc = descrizione.trim()

  // Prelievo ATM
  if (/^Prelievo atm/i.test(desc)) return 'PRELIEVO ATM'

  // PAGAMENTO CARTA DI CREDITO
  if (/^PAGAMENTO CARTA DI CREDITO/i.test(desc)) return 'PAGAMENTO CARTA DI CREDITO'

  // CANONE
  if (/^CANONE\s/i.test(desc)) {
    const m = desc.match(/^CANONE\s+SERVIZIO\s+(.+?)(?:\s{2,}|\s+-\s+UTENTE)/i)
    return m ? 'CANONE ' + m[1].trim() : desc.substring(0, 50)
  }

  // BONIFICO / EMOLUMENTI: "BONIFICO o/c: NAME  ABI-CAB:..."
  const bonificoMatch = desc.match(/(?:BONIFICO|EMOLUMENTI)\s+o\/c:\s+(.+?)\s{2,}/i)
  if (bonificoMatch) return bonificoMatch[1].trim()

  // ADDEBITO SDD / COMMISSIONI: "ADDEBITO SDD NAME   N:..."
  const addebitoMatch = desc.match(/^(?:ADDEBITO SDD|COMMISSIONI)\s+(.+?)\s{2,}/i)
  if (addebitoMatch) return addebitoMatch[1].trim()

  // Remove "Sum*" prefix
  const cleaned = desc.replace(/^Sum\*/, '')

  // Carta con ITA marker: "NAME CITY [POSTAL] ITA Operazione..."
  const itaIdx = cleaned.search(/\s+ITA\s/i)
  if (itaIdx !== -1) {
    const beforeIta = cleaned.substring(0, itaIdx)
    const parts = beforeIta.split(' ').filter(Boolean)
    let cut = parts.length
    // Strip postal code (5 digits)
    if (cut > 0 && /^\d{5}$/.test(parts[cut - 1])) cut--
    // Strip city name (alphabetic only, uppercase)
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut--
    if (cut > 0 && cut < parts.length) return parts.slice(0, cut).join(' ')
    return beforeIta
  }

  // Bancomat (senza ITA): "NAME CITY REGION Operazione Carta..."
  const opIdx = cleaned.search(/\s+Operazione\s+[Cc]arta/i)
  if (opIdx !== -1) {
    const beforeOp = cleaned.substring(0, opIdx)
    const parts = beforeOp.split(' ').filter(Boolean)
    let cut = parts.length
    if (cut > 0 && /^[A-Z]{2}$/.test(parts[cut - 1])) cut-- // region MO, BO, etc.
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut-- // city
    if (cut > 0 && /^[A-Z]{2,}$/.test(parts[cut - 1])) cut-- // repeated city
    if (cut > 0 && cut < parts.length) return parts.slice(0, cut).join(' ')
    return beforeOp
  }

  return cleaned.substring(0, 80).trim()
}

export function normalizeEnte(nome: string): string {
  return nome.toUpperCase().replace(/\s+/g, ' ').trim()
}
