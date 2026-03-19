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
  return (await getTariffaDebug(committenteId, clienteId, tipoAttivitaId, tipoVoce, data)).tariffa
}

export async function getTariffaDebug(
  committenteId: number,
  clienteId: number | null,
  tipoAttivitaId: number | null,
  tipoVoce: TipoVoce,
  data: Date = new Date()
): Promise<{ tariffa: Decimal | null; debug: object }> {
  const base = {
    committenteId,
    dataInizio: { lte: data },
    OR: [{ dataFine: null }, { dataFine: { gte: data } }],
  }
  const dove = { ...base, tipoVoce }

  const allRecords = await prisma.listino.findMany({
    where: { committenteId },
    select: { id: true, clienteId: true, tipoAttivitaId: true, tipoVoce: true, tariffa: true, dataInizio: true, dataFine: true },
  })

  const debug = {
    params: { committenteId, clienteId, tipoAttivitaId, tipoVoce, data: data.toISOString() },
    allRecords: allRecords.map(r => ({
      ...r,
      tariffa: r.tariffa.toString(),
      dataInizio: r.dataInizio.toISOString(),
      dataFine: r.dataFine?.toISOString() ?? null,
    })),
  }

  if (clienteId !== null) {
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId } })
      if (r) return { tariffa: r.tariffa, debug: { ...debug, foundAt: 'step1 cliente+tipo+tipoVoce' } }
      const r1b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId } })
      if (r1b) return { tariffa: r1b.tariffa, debug: { ...debug, foundAt: 'step1b cliente+tipo' } }
    }

    const r2 = await prisma.listino.findFirst({ where: { ...dove, clienteId, tipoAttivitaId: null } })
    if (r2) return { tariffa: r2.tariffa, debug: { ...debug, foundAt: 'step2 cliente+tipoVoce' } }
    const r2b = await prisma.listino.findFirst({ where: { ...base, clienteId, tipoAttivitaId: null } })
    if (r2b) return { tariffa: r2b.tariffa, debug: { ...debug, foundAt: 'step2b cliente' } }
    const r2c = await prisma.listino.findFirst({ where: { ...base, clienteId } })
    if (r2c) return { tariffa: r2c.tariffa, debug: { ...debug, foundAt: 'step2c cliente any' } }
  }

  if (tipoAttivitaId) {
    const r3 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId } })
    if (r3) return { tariffa: r3.tariffa, debug: { ...debug, foundAt: 'step3 committente+tipo+tipoVoce' } }
    const r3b = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId } })
    if (r3b) return { tariffa: r3b.tariffa, debug: { ...debug, foundAt: 'step3b committente+tipo' } }
  }

  const r4 = await prisma.listino.findFirst({ where: { ...dove, clienteId: null, tipoAttivitaId: null } })
  if (r4) return { tariffa: r4.tariffa, debug: { ...debug, foundAt: 'step4 committente+tipoVoce' } }

  const r5 = await prisma.listino.findFirst({ where: { ...base, clienteId: null, tipoAttivitaId: null } })
  if (r5) return { tariffa: r5.tariffa, debug: { ...debug, foundAt: 'step5 committente default' } }

  // Fallback senza filtro date: prende il record più recente ignorando dataInizio/dataFine
  // Utile quando l'attività ha data precedente alla dataInizio del listino
  const noDate = { committenteId }
  if (clienteId !== null) {
    if (tipoAttivitaId) {
      const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId, tipoAttivitaId }, orderBy: { dataInizio: 'desc' } })
      if (r) return { tariffa: r.tariffa, debug: { ...debug, foundAt: 'fallback cliente+tipo (no date)' } }
    }
    const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId }, orderBy: { dataInizio: 'desc' } })
    if (r) return { tariffa: r.tariffa, debug: { ...debug, foundAt: 'fallback cliente (no date)' } }
  }
  if (tipoAttivitaId) {
    const r = await prisma.listino.findFirst({ where: { ...noDate, clienteId: null, tipoAttivitaId }, orderBy: { dataInizio: 'desc' } })
    if (r) return { tariffa: r.tariffa, debug: { ...debug, foundAt: 'fallback committente+tipo (no date)' } }
  }
  const r6 = await prisma.listino.findFirst({ where: { ...noDate, clienteId: null, tipoAttivitaId: null }, orderBy: { dataInizio: 'desc' } })
  return { tariffa: r6?.tariffa ?? null, debug: { ...debug, foundAt: r6 ? 'fallback committente default (no date)' : 'NOT FOUND' } }
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
