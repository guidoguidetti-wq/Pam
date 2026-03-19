import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'

type TipoVoce = 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'

/**
 * Risolve la tariffa vigente alla data per committente/cliente/tipo attività.
 * Priorità: cliente+tipo > cliente > committente+tipo > committente default
 * Per ogni step: prima cerca con tipoVoce esatto, poi senza filtro tipoVoce.
 * Fallback finale senza filtro date (per attività con data precedente a dataInizio listino).
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

  if (clienteId !== null) {
    // 1. Cliente + tipo specifico
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId } })
      if (r) return r.tariffa
      const r1b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId } })
      if (r1b) return r1b.tariffa
    }

    // 2. Cliente flat (qualsiasi tipo attività)
    const r2 = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId: null } })
    if (r2) return r2.tariffa
    const r2b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId: null } })
    if (r2b) return r2b.tariffa

    // 2c. Cliente, qualsiasi record
    const r2c = await prisma.listino.findFirst({ where: { ...base, clienteId } })
    if (r2c) return r2c.tariffa
  }

  // 3. Committente + tipo specifico (nessun cliente)
  if (tipoAttivitaId) {
    const r3 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId } })
    if (r3) return r3.tariffa
    const r3b = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId } })
    if (r3b) return r3b.tariffa
  }

  // 4. Default committente
  const r4 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId: null } })
  if (r4) return r4.tariffa
  const r5 = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId: null } })
  if (r5) return r5.tariffa

  // Fallback senza filtro date: per attività con data precedente a dataInizio listino
  const noDate = { committenteId }
  if (clienteId !== null) {
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId, tipoAttivitaId }, orderBy: { dataInizio: 'desc' } })
      if (r) return r.tariffa
    }
    const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId }, orderBy: { dataInizio: 'desc' } })
    if (r) return r.tariffa
  }
  if (tipoAttivitaId) {
    const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId: null, tipoAttivitaId }, orderBy: { dataInizio: 'desc' } })
    if (r) return r.tariffa
  }
  const r6 = await prisma.listino.findFirst({ where: { ...noDate, clienteId: null, tipoAttivitaId: null }, orderBy: { dataInizio: 'desc' } })
  return r6?.tariffa ?? null
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
  if (r2?.tariffaKm) return r2.tariffaKm

  // Fallback senza filtro date
  const noDate = { committenteId, tariffaKm: { not: null } }
  if (clienteId !== null) {
    const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId }, orderBy: { dataInizio: 'desc' } })
    if (r?.tariffaKm) return r.tariffaKm
  }
  const r3 = await prisma.listino.findFirst({ where: { ...noDate, clienteId: null }, orderBy: { dataInizio: 'desc' } })
  return r3?.tariffaKm ?? null
}
