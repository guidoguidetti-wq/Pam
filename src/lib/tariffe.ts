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
  const base = {
    committenteId,
    dataInizio: { lte: data },
    OR: [{ dataFine: null }, { dataFine: { gte: data } }],
  }
  const dove = { ...base, tipoVoce }
  console.log('[getTariffa] start', { committenteId, clienteId, tipoAttivitaId, tipoVoce, data })
  const allRecords = await prisma.listino.findMany({
    where: { committenteId },
    select: { id: true, clienteId: true, tipoAttivitaId: true, tipoVoce: true, tariffa: true, dataInizio: true, dataFine: true },
  })
  console.log('[getTariffa] all listino records for committente', committenteId, JSON.stringify(allRecords, null, 2))

  if (clienteId !== null) {
    // 1. Cliente + tipo specifico (con tipoVoce esatto, poi senza)
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId } })
      if (r) return r.tariffa
      const r1b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId } })
      if (r1b) return r1b.tariffa
    }

    // 2. Cliente, qualsiasi tipoAttivita (con tipoVoce esatto, poi senza)
    const r2 = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId: null } })
    if (r2) return r2.tariffa
    const r2b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId: null } })
    if (r2b) return r2b.tariffa

    // 2c. Cliente, qualsiasi tipoAttivita e qualsiasi tipoVoce (flat rate cliente)
    const r2c = await prisma.listino.findFirst({ where: { ...base, clienteId } })
    if (r2c) return r2c.tariffa
  }

  // 3. Committente + tipo specifico, nessun cliente (con tipoVoce esatto, poi senza)
  if (tipoAttivitaId) {
    const r3 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId } })
    if (r3) return r3.tariffa
    const r3b = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId } })
    if (r3b) return r3b.tariffa
  }

  // 4. Default committente (con tipoVoce esatto, poi senza)
  const r4 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId: null } })
  if (r4) return r4.tariffa

  const r5 = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId: null } })
  return r5?.tariffa ?? null
}

/**
 * Risolve la tariffa km vigente (campo tariffaKm) per committente/cliente.
 * Priorità: cliente specifico > default committente
 */
export async function getTariffaKm(
  committenteId: number,
  clienteId: number | null,
  data: Date = new Date()
): Promise<Decimal | null> {
  const dove = {
    committenteId,
    tariffaKm: { not: null },
    dataInizio: { lte: data },
    OR: [{ dataFine: null }, { dataFine: { gte: data } }],
  }

  if (clienteId !== null) {
    const r = await prisma.listino.findFirst({ where: { ...dove, clienteId } })
    if (r?.tariffaKm) return r.tariffaKm
  }

  const r2 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null } })
  return r2?.tariffaKm ?? null
}
