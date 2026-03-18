import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'

type TipoVoce = 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'

/**
 * Risolve la tariffa vigente alla data per committente/cliente/tipo attività.
 * Priorità: cliente+tipo > cliente > tipo > default committente
 * clienteId null = nessun cliente (salta i lookup client-specifici)
 */
export async function getTariffa(
  committenteId: number,
  clienteId: number | null,
  tipoAttivitaId: number | null,
  tipoVoce: TipoVoce,
  data: Date = new Date()
): Promise<Decimal | null> {
  const dove = {
    committenteId,
    tipoVoce,
    dataInizio: { lte: data },
    OR: [{ dataFine: null }, { dataFine: { gte: data } }],
  }

  if (clienteId !== null) {
    // 1. Cliente + tipo specifico
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({
        where: { ...dove, clienteId, tipoAttivitaId },
      })
      if (r) return r.tariffa
    }

    // 2. Cliente, qualsiasi tipo
    const r2 = await prisma.listino.findFirst({
      where: { ...dove, clienteId, tipoAttivitaId: null },
    })
    if (r2) return r2.tariffa
  }

  // 3. Committente + tipo specifico (nessun cliente)
  if (tipoAttivitaId) {
    const r3 = await prisma.listino.findFirst({
      where: { ...dove, clienteId: null, tipoAttivitaId },
    })
    if (r3) return r3.tariffa
  }

  // 4. Default committente
  const r4 = await prisma.listino.findFirst({
    where: { ...dove, clienteId: null, tipoAttivitaId: null },
  })
  return r4?.tariffa ?? null
}
