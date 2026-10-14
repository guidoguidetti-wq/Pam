/**
 * PAM — Ripristino totale database da backup SQL (Node.js ≥ 22.18)
 *
 * ATTENZIONE: cancella TUTTO lo schema `public` del database di destinazione
 * (DROP SCHEMA public CASCADE) e lo ricrea dal file di backup.
 * L'intera operazione avviene in un'unica transazione: in caso di errore
 * il database resta com'era.
 *
 * Uso:
 *   node scripts/restore-pam.mjs <file.sql | file.sql.gz> [--url "<connection string>"] --yes
 *
 * Se --url non è indicato usa DIRECT_URL (o DATABASE_URL) da .env.local / .env.
 * Per Neon preferire la connessione diretta (non "-pooler").
 */

import fs   from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { STATEMENT_SEPARATOR } from '../src/lib/backup-sql.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    return
  }
}

function usage(msg) {
  if (msg) console.error(`ERRORE: ${msg}\n`)
  console.error('Uso: node scripts/restore-pam.mjs <file.sql | file.sql.gz> [--url "<connection string>"] --yes')
  process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--url')
  const urlIdx = args.indexOf('--url')
  const confirmed = args.includes('--yes')

  if (!file) usage('file di backup mancante')
  if (!fs.existsSync(file)) usage(`file non trovato: ${file}`)

  loadEnv()
  const url = urlIdx !== -1 ? args[urlIdx + 1] : (process.env.DIRECT_URL || process.env.DATABASE_URL)
  if (!url) usage('connection string mancante (--url oppure DIRECT_URL/DATABASE_URL)')

  let target
  try {
    const u = new URL(url)
    target = `${u.hostname}${u.pathname}`
  } catch {
    usage('connection string non valida')
  }

  const raw = fs.readFileSync(file)
  const sql = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8')

  if (!sql.includes(STATEMENT_SEPARATOR)) usage('il file non è un backup SQL di PAM (formato non riconosciuto)')

  // Separa le istruzioni; BEGIN/COMMIT del file sono sostituiti dalla transazione Prisma
  const statements = sql
    .split(new RegExp(`^${STATEMENT_SEPARATOR}\\r?$`, 'm'))
    .map((s) => s.replace(/^(\s*--[^\n]*\n)+/, '').trim())
    .filter((s) => s && !/^(BEGIN|COMMIT);$/i.test(s))

  console.log(`File:         ${file}`)
  console.log(`Destinazione: ${target}`)
  console.log(`Istruzioni:   ${statements.length}`)

  if (!confirmed) {
    console.log('\nLo schema "public" della destinazione verrà CANCELLATO e ricreato.')
    console.log('Riesegui aggiungendo --yes per confermare.')
    process.exit(1)
  }

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasourceUrl: url })

  try {
    const t0 = Date.now()
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE')
      await tx.$executeRawUnsafe('CREATE SCHEMA public')
      for (let i = 0; i < statements.length; i++) {
        try {
          await tx.$executeRawUnsafe(statements[i])
        } catch (err) {
          console.error(`\nErrore all'istruzione ${i + 1}:\n${statements[i].slice(0, 500)}\n`)
          throw err
        }
        if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${statements.length}\r`)
      }
    }, { maxWait: 30_000, timeout: 15 * 60_000 })

    console.log(`\nRipristino completato in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(`RIPRISTINO FALLITO (nessuna modifica applicata): ${err.message ?? err}`)
  process.exit(1)
})
