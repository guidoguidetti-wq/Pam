/**
 * PAM — Backup completo database (struttura + dati) via Prisma (Node.js ≥ 22.18)
 * Non richiede pg_dump né tool esterni.
 * Genera un file .sql.gz ripristinabile con scripts/restore-pam.mjs (o psql).
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
import { buildSqlDump } from '../src/lib/backup-sql.ts'

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

// ── Backup ────────────────────────────────────────────────────────────────────

async function main() {
  log('=== Avvio backup PAM ===')

  loadEnv()

  // Import dinamico DOPO aver caricato le env (Prisma legge DATABASE_URL da process.env)
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    log('Connessione al database...')

    const { sql, stats } = await buildSqlDump((q) => prisma.$queryRawUnsafe(q))
    log(`Record letti: ${JSON.stringify(stats.tables)}`)

    // Crea directory backup se non esiste
    fs.mkdirSync(BACKUP_DIR, { recursive: true })

    // Nome file con timestamp
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const dest = path.join(BACKUP_DIR, `pam_${ts}.sql.gz`)

    // Comprimi e scrivi
    await new Promise((resolve, reject) => {
      const gzip = zlib.createGzip({ level: 9 })
      const out  = fs.createWriteStream(dest)
      gzip.on('error', reject)
      out.on('error',  reject)
      out.on('finish', resolve)
      gzip.pipe(out)
      gzip.end(Buffer.from(sql, 'utf8'))
    })

    const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(2)
    log(`Backup salvato: ${dest} (${sizeMB} MB)`)

    // Rotazione
    const cutoff  = Date.now() - KEEP_DAYS * 86400 * 1000
    let   deleted = 0
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.startsWith('pam_') || !/\.(sql|json)\.gz$/.test(f)) continue
      const fp  = path.join(BACKUP_DIR, f)
      const mts = fs.statSync(fp).mtimeMs
      if (mts < cutoff) {
        fs.rmSync(fp)
        log(`Eliminato backup scaduto: ${f}`)
        deleted++
      }
    }
    if (deleted > 0) log(`Rimossi ${deleted} backup scaduti (>${KEEP_DAYS} giorni)`)

    const total = fs.readdirSync(BACKUP_DIR).filter(f => /\.(sql|json)\.gz$/.test(f)).length
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
