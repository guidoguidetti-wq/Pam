/**
 * PAM — Generatore dump SQL completo (struttura + dati) dello schema `public`.
 *
 * Produce uno script SQL autoconsistente, stile pg_dump, che ricrea da zero:
 * estensioni, enum, sequence, tabelle, dati, vincoli (PK/UNIQUE/CHECK/FK),
 * indici, funzioni, viste, trigger e valori correnti delle sequence.
 * Include anche `_prisma_migrations`, così dopo il ripristino Prisma
 * riconosce le migrazioni già applicate.
 *
 * Usato sia dalla API `/api/backup` sia da `scripts/backup-pam.mjs`
 * (Node ≥ 22.18 esegue direttamente il TypeScript): per questo il file
 * non ha import e usa solo sintassi TS "erasable".
 *
 * Ogni istruzione è seguita da una riga `--;;` (commento SQL, innocuo per psql)
 * che permette a `scripts/restore-pam.mjs` di separare le istruzioni in modo sicuro.
 */

export type Row = Record<string, unknown>
export type QueryFn = (sql: string) => Promise<Row[]>

export const STATEMENT_SEPARATOR = '--;;'

const SCHEMA = 'public'
const ROWS_PER_INSERT = 500

export interface DumpStats {
  tables: Record<string, number>
}

export interface DumpResult {
  sql: string
  stats: DumpStats
}

function qi(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"'
}

function ql(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'"
}

function rel(name: string): string {
  return `${qi(SCHEMA)}.${qi(name)}`
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function stripSemicolon(s: string): string {
  return s.trim().replace(/;+\s*$/, '')
}

export async function buildSqlDump(query: QueryFn): Promise<DumpResult> {
  const out: string[] = []
  const stmt = (s: string) => out.push(stripSemicolon(s) + ';\n' + STATEMENT_SEPARATOR)
  const section = (title: string) => out.push(`\n-- ─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`)

  // ── Lettura catalogo ────────────────────────────────────────────────────
  const [extensions, enums, sequences, seqValues, columns, constraints, indexes, functions, views, triggers] =
    await Promise.all([
      query(`SELECT extname::text AS name FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY extname`),

      query(`
        SELECT t.typname::text AS name,
               array_to_json(array_agg(e.enumlabel::text ORDER BY e.enumsortorder))::text AS labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = '${SCHEMA}'
        GROUP BY t.typname
        ORDER BY t.typname`),

      // Sequence "standalone" (serial), escluse quelle delle colonne IDENTITY
      query(`
        SELECT c.relname::text AS name,
               format_type(s.seqtypid, NULL) AS type,
               s.seqstart::text AS start, s.seqincrement::text AS inc,
               s.seqmin::text AS min, s.seqmax::text AS max,
               s.seqcache::text AS cache, s.seqcycle AS cycle,
               (SELECT quote_ident(tc.relname) || '.' || quote_ident(a.attname)
                  FROM pg_depend d
                  JOIN pg_class tc ON tc.oid = d.refobjid
                  JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                 WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass
                   AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'a'
                 LIMIT 1) AS owned_by
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_sequence s ON s.seqrelid = c.oid
        WHERE n.nspname = '${SCHEMA}' AND c.relkind = 'S'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d
                           WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'i')
        ORDER BY c.relname`),

      query(`
        SELECT sequencename::text AS name, last_value::text AS last_value
        FROM pg_sequences
        WHERE schemaname = '${SCHEMA}' AND last_value IS NOT NULL
        ORDER BY sequencename`),

      query(`
        SELECT c.relname::text AS tbl, a.attname::text AS col,
               format_type(a.atttypid, a.atttypmod) AS type,
               a.attnotnull AS notnull,
               pg_get_expr(ad.adbin, ad.adrelid) AS def,
               a.attidentity::text AS identity,
               a.attgenerated::text AS generated
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE n.nspname = '${SCHEMA}' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY c.relname, a.attnum`),

      query(`
        SELECT c.relname::text AS tbl, co.conname::text AS name,
               co.contype::text AS type, pg_get_constraintdef(co.oid) AS def
        FROM pg_constraint co
        JOIN pg_class c ON c.oid = co.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = '${SCHEMA}' AND co.contype IN ('p', 'u', 'x', 'c', 'f')
        ORDER BY c.relname, co.conname`),

      // Indici non legati a PK/UNIQUE/EXCLUDE (quelli li crea il vincolo stesso)
      query(`
        SELECT pg_get_indexdef(i.indexrelid) AS def
        FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_class tc ON tc.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = tc.relnamespace
        WHERE n.nspname = '${SCHEMA}' AND tc.relkind = 'r'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint co
                           WHERE co.conindid = i.indexrelid AND co.conrelid = i.indrelid
                             AND co.contype IN ('p', 'u', 'x'))
        ORDER BY ic.relname`),

      query(`
        SELECT pg_get_functiondef(p.oid) AS def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = '${SCHEMA}' AND p.prokind IN ('f', 'p')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
        ORDER BY p.proname`),

      query(`
        SELECT c.relname::text AS name, c.relkind::text AS kind, pg_get_viewdef(c.oid, true) AS def
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = '${SCHEMA}' AND c.relkind IN ('v', 'm')
        ORDER BY c.oid`),

      query(`
        SELECT pg_get_triggerdef(t.oid) AS def
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = '${SCHEMA}' AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname`),
    ])

  // Raggruppa colonne per tabella
  const tables = new Map<string, Row[]>()
  for (const c of columns) {
    const t = str(c.tbl)
    if (!tables.has(t)) tables.set(t, [])
    tables.get(t)!.push(c)
  }

  // ── Intestazione ────────────────────────────────────────────────────────
  out.push(
    [
      '-- ============================================================',
      '--  PAM — Backup completo database (struttura + dati)',
      `--  Generato: ${new Date().toISOString()}`,
      `--  Schema:   ${SCHEMA}`,
      '--',
      '--  RIPRISTINO (su database vuoto):',
      '--    node scripts/restore-pam.mjs <questo-file> --url "<connection string>" --yes',
      '--  oppure con psql:',
      '--    psql "<connection string>" -v ON_ERROR_STOP=1 -f <questo-file>',
      '--  Se il database contiene già lo schema, svuotarlo prima con:',
      '--    DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
      '-- ============================================================',
    ].join('\n'),
  )

  stmt('BEGIN')
  stmt(`SET client_encoding = 'UTF8'`)
  stmt('SET standard_conforming_strings = on')
  stmt('SET check_function_bodies = false')
  stmt(`SET search_path = ${qi(SCHEMA)}, pg_catalog`)

  if (extensions.length) {
    section('Estensioni')
    for (const e of extensions) stmt(`CREATE EXTENSION IF NOT EXISTS ${qi(str(e.name))}`)
  }

  if (enums.length) {
    section('Tipi enum')
    for (const e of enums) {
      const labels = JSON.parse(str(e.labels)) as string[]
      stmt(`CREATE TYPE ${rel(str(e.name))} AS ENUM (${labels.map(ql).join(', ')})`)
    }
  }

  if (sequences.length) {
    section('Sequence')
    for (const s of sequences) {
      stmt(
        `CREATE SEQUENCE ${rel(str(s.name))} AS ${s.type} INCREMENT BY ${s.inc} ` +
          `MINVALUE ${s.min} MAXVALUE ${s.max} START WITH ${s.start} CACHE ${s.cache}` +
          (s.cycle ? ' CYCLE' : ' NO CYCLE'),
      )
    }
  }

  section('Tabelle')
  for (const [table, cols] of tables) {
    const defs = cols.map((c) => {
      let d = `  ${qi(str(c.col))} ${c.type}`
      if (c.generated === 's') d += ` GENERATED ALWAYS AS (${c.def}) STORED`
      else if (c.identity === 'a') d += ' GENERATED ALWAYS AS IDENTITY'
      else if (c.identity === 'd') d += ' GENERATED BY DEFAULT AS IDENTITY'
      else if (c.def != null) d += ` DEFAULT ${c.def}`
      if (c.notnull) d += ' NOT NULL'
      return d
    })
    stmt(`CREATE TABLE ${rel(table)} (\n${defs.join(',\n')}\n)`)
  }

  const owned = sequences.filter((s) => s.owned_by)
  if (owned.length) {
    for (const s of owned) stmt(`ALTER SEQUENCE ${rel(str(s.name))} OWNED BY ${qi(SCHEMA)}.${s.owned_by}`)
  }

  // ── Dati ────────────────────────────────────────────────────────────────
  section('Dati')
  const stats: DumpStats = { tables: {} }
  for (const [table, cols] of tables) {
    const rows = await query(`SELECT row_to_json(t)::text AS j FROM ${rel(table)} t`)
    stats.tables[table] = rows.length
    if (!rows.length) continue

    const insertable = cols.filter((c) => c.generated !== 's').map((c) => qi(str(c.col)))
    const overriding = cols.some((c) => c.identity === 'a') ? ' OVERRIDING SYSTEM VALUE' : ''
    const colList = insertable.join(', ')

    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const chunk = rows.slice(i, i + ROWS_PER_INSERT).map((r) => str(r.j))
      stmt(
        `INSERT INTO ${rel(table)} (${colList})${overriding}\n` +
          `SELECT ${colList} FROM json_populate_recordset(NULL::${rel(table)}, ${ql('[' + chunk.join(',\n') + ']')})`,
      )
    }
  }

  // ── Vincoli e indici (dopo i dati, come pg_dump) ────────────────────────
  const byType = (types: string[]) => constraints.filter((c) => types.includes(str(c.type)))
  const keys = byType(['p', 'u', 'x', 'c'])
  if (keys.length) {
    section('Chiavi primarie, unique e check')
    for (const c of keys) stmt(`ALTER TABLE ${rel(str(c.tbl))} ADD CONSTRAINT ${qi(str(c.name))} ${c.def}`)
  }

  if (indexes.length) {
    section('Indici')
    for (const i of indexes) stmt(str(i.def))
  }

  const fks = byType(['f'])
  if (fks.length) {
    section('Chiavi esterne')
    for (const c of fks) stmt(`ALTER TABLE ${rel(str(c.tbl))} ADD CONSTRAINT ${qi(str(c.name))} ${c.def}`)
  }

  if (functions.length) {
    section('Funzioni')
    for (const f of functions) stmt(str(f.def))
  }

  if (views.length) {
    section('Viste')
    for (const v of views) {
      const kind = v.kind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW'
      stmt(`CREATE ${kind} ${rel(str(v.name))} AS\n${stripSemicolon(str(v.def))}`)
    }
  }

  if (triggers.length) {
    section('Trigger')
    for (const t of triggers) stmt(str(t.def))
  }

  if (seqValues.length) {
    section('Valori sequence')
    for (const s of seqValues) {
      stmt(`SELECT pg_catalog.setval(${ql(rel(str(s.name)))}, ${s.last_value}, true)`)
    }
  }

  stmt('COMMIT')

  return { sql: out.join('\n') + '\n', stats }
}
