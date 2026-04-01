/**
 * PAM — Backup database via Prisma (Node.js)
 * Non richiede pg_dump né tool esterni.
 *
 * Uso:
 *   node scripts/backup-pam.mjs
 *
 * Opzioni (variabili d'ambiente):
 *   BACKUP_DIR   directory dove salvare i file  (default: scripts/backups)
 *   KEEP_DAYS    giorni di retention            (default: 30)
 */

import fs   from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ── Percorsi ──────────────────────────────────────────────────────────────────

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(__dirname, 'backups')
const KEEP_DAYS  = parseInt(process.env.KEEP_DAYS ?? '30', 10)
const LOG_FILE   = path.join(__dirname, 'backup.log')

// ── Log ───────────────────────────────────────────────────────────────────────

function log(msg, level = 'INFO') {
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${ts}] [${level}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8')
}

// ── Leggi .env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const candidates = ['.env.local', '.env']
  for (const name of candidates) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    log(`Configurazione da: ${p}`)
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val   // non sovrascrivere se già impostata
    }
    return
  }
  log('Nessun file .env trovato', 'WARN')
}

// ── Serializzazione sicura (BigInt + Decimal) ─────────────────────────────────

function replacer(_key, value) {
  if (typeof value === 'bigint') return value.toString()
  // Prisma Decimal: ha metodo toFixed
  if (value !== null && typeof value === 'object' && typeof value.toFixed === 'function') {
    return value.toString()
  }
  return value
}

// ── Backup ────────────────────────────────────────────────────────────────────

async function main() {
  log('=== Avvio backup PAM ===')

  loadEnv()

  // Import dinamico DOPO aver caricato le env (Prisma legge DATABASE_URL da process.env)
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    log('Connessione al database...')

    // Leggi tutti i modelli
    const [
      tipiAttivita,
      committenti,
      clienti,
      listino,
      progetti,
      progettoStime,
      attivita,
      spese,
      allegati,
    ] = await Promise.all([
      prisma.tipoAttivita.findMany(),
      prisma.committente.findMany(),
      prisma.cliente.findMany(),
      prisma.listino.findMany(),
      prisma.progetto.findMany(),
      prisma.progettoStima.findMany(),
      prisma.attivita.findMany(),
      prisma.spesa.findMany(),
      prisma.allegato.findMany(),
    ])

    const stats = {
      tipiAttivita: tipiAttivita.length,
      committenti:  committenti.length,
      clienti:      clienti.length,
      listino:      listino.length,
      progetti:     progetti.length,
      progettoStime: progettoStime.length,
      attivita:     attivita.length,
      spese:        spese.length,
      allegati:     allegati.length,
    }
    log(`Record letti: ${JSON.stringify(stats)}`)

    const dump = {
      meta: {
        version:   1,
        createdAt: new Date().toISOString(),
        tables:    stats,
      },
      data: {
        tipiAttivita,
        committenti,
        clienti,
        listino,
        progetti,
        progettoStime,
        attivita,
        spese,
        allegati,
      },
    }

    // Serializza JSON
    const json = JSON.stringify(dump, replacer, 2)

    // Crea directory backup se non esiste
    fs.mkdirSync(BACKUP_DIR, { recursive: true })

    // Nome file con timestamp
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const dest = path.join(BACKUP_DIR, `pam_${ts}.json.gz`)

    // Comprimi e scrivi
    await new Promise((resolve, reject) => {
      const gzip = zlib.createGzip({ level: 9 })
      const out  = fs.createWriteStream(dest)
      gzip.on('error', reject)
      out.on('error',  reject)
      out.on('finish', resolve)
      gzip.pipe(out)
      gzip.end(Buffer.from(json, 'utf8'))
    })

    const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(2)
    log(`Backup salvato: ${dest} (${sizeMB} MB)`)

    // Rotazione
    const cutoff  = Date.now() - KEEP_DAYS * 86400 * 1000
    let   deleted = 0
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.startsWith('pam_') || !f.endsWith('.json.gz')) continue
      const fp  = path.join(BACKUP_DIR, f)
      const mts = fs.statSync(fp).mtimeMs
      if (mts < cutoff) {
        fs.rmSync(fp)
        log(`Eliminato backup scaduto: ${f}`)
        deleted++
      }
    }
    if (deleted > 0) log(`Rimossi ${deleted} backup scaduti (>${KEEP_DAYS} giorni)`)

    const total = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz')).length
    log(`Backup totali conservati: ${total}`)

  } finally {
    await prisma.$disconnect()
  }

  log('=== Backup completato ===')
}

main().catch(err => {
  log(`ERRORE FATALE: ${err.message ?? err}`, 'ERROR')
  process.exit(1)
})
