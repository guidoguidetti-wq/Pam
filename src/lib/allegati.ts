import type { Allegato } from '@prisma/client'

// BigInt non è serializzabile in JSON: converte gli id in stringa
export function serializeAllegato(a: Allegato) {
  return {
    ...a,
    id: a.id.toString(),
    spesaId: a.spesaId?.toString() ?? null,
    attivitaId: a.attivitaId?.toString() ?? null,
  }
}
