import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatta minuti in "X h YY m" */
export function formatOre(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')} m`
}

/** Formatta importo in valuta */
export function formatValuta(importo: number | null | undefined, valuta = 'EUR'): string {
  if (importo == null) return '—'
  // useGrouping 'always': in it-IT il default non mette il punto sui numeri a 4 cifre (1234,00 €)
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: valuta, useGrouping: 'always' }).format(importo)
}

/** Formatta minuti in giornate lavorative (default 8 h/giorno), es. "12,5 gg" */
export function formatGiornate(minuti: number, oreGiornata = 8): string {
  const gg = minuti / 60 / oreGiornata
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, useGrouping: 'always' }).format(gg)} gg`
}

/** Colore committente deterministico da ID */
export function coloreCommittente(id: number): string {
  return `hsl(${(id * 47) % 360}, 65%, 55%)`
}

/** Calcola durata in minuti tra due stringhe "HH:MM" */
export function calcolaDurata(inizio: string, fine: string): number {
  const [hi, mi] = inizio.split(':').map(Number)
  const [hf, mf] = fine.split(':').map(Number)
  return hf * 60 + mf - (hi * 60 + mi)
}
