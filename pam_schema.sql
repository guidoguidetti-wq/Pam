-- ============================================================
--  PAM - Personal Activity Manager
--  Schema PostgreSQL v1.0
--  Guido Guidetti @ Softintime
-- ============================================================

-- ============================================================
--  1. TIPO ATTIVITÀ  (lookup)
-- ============================================================
CREATE TABLE tipo_attivita (
    id          SMALLSERIAL  PRIMARY KEY,
    codice      VARCHAR(10)  NOT NULL UNIQUE,   -- COM, PRE, PMG, BAN, SVI, OPS
    descrizione VARCHAR(100) NOT NULL,
    attivo      BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO tipo_attivita (codice, descrizione) VALUES
    ('COM', 'Commerciale'),
    ('PRE', 'Presale'),
    ('PMG', 'Project Management'),
    ('BAN', 'Business Analyst'),
    ('SVI', 'Sviluppo'),
    ('OPS', 'Operation');


-- ============================================================
--  2. COMMITTENTI
-- ============================================================
CREATE TABLE committente (
    id               SERIAL       PRIMARY KEY,
    ragione_sociale  VARCHAR(200) NOT NULL,
    partita_iva      VARCHAR(20),
    codice_fiscale   VARCHAR(16),
    indirizzo        TEXT,
    email            VARCHAR(150),
    telefono         VARCHAR(30),
    note             TEXT,
    attivo           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================
--  3. CLIENTI
--     Ogni cliente appartiene a un committente.
--     Un committente può affidarti più clienti.
-- ============================================================
CREATE TABLE cliente (
    id               SERIAL       PRIMARY KEY,
    committente_id   INT          NOT NULL REFERENCES committente(id) ON DELETE RESTRICT,
    ragione_sociale  VARCHAR(200) NOT NULL,
    partita_iva      VARCHAR(20),
    indirizzo        TEXT,
    email            VARCHAR(150),
    note             TEXT,
    attivo           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cliente_committente ON cliente(committente_id);


-- ============================================================
--  4. LISTINO TARIFFE
--
--  Logica di risoluzione della tariffa (priorità decrescente):
--    1. committente_id + cliente_id + tipo_attivita_id  → tariffa specifica
--    2. committente_id + cliente_id  (tipo_attivita NULL) → flat cliente
--    3. committente_id + tipo_attivita_id (cliente NULL)  → tipo generico
--    4. committente_id solo (cliente NULL, tipo NULL)      → default committente
--
--  tipo_voce:
--    ORARIO      → tariffa per ora
--    GIORNALIERO → tariffa per giornata (default 8 h)
--    KM          → indennità chilometrica (€/km)
--    RIMBORSO    → voce fissa (es. diaria giornaliera)
--
--  Solo una riga attiva per la stessa combinazione committente/cliente/tipo
--  in un determinato intervallo date (enforced applicativamente).
-- ============================================================
CREATE TABLE listino (
    id               SERIAL        PRIMARY KEY,
    committente_id   INT           NOT NULL REFERENCES committente(id) ON DELETE RESTRICT,
    cliente_id       INT           REFERENCES cliente(id) ON DELETE RESTRICT,  -- NULL = default committente
    tipo_attivita_id SMALLINT      REFERENCES tipo_attivita(id),               -- NULL = tutti i tipi
    tipo_voce        VARCHAR(15)   NOT NULL CHECK (tipo_voce IN ('ORARIO','GIORNALIERO','KM','RIMBORSO')),
    tariffa          NUMERIC(10,4) NOT NULL CHECK (tariffa >= 0),
    valuta           CHAR(3)       NOT NULL DEFAULT 'EUR',
    ore_giornata     NUMERIC(4,2)  DEFAULT 8.00,   -- ore standard di una giornata lavorativa
    data_inizio      DATE          NOT NULL,
    data_fine        DATE,
    note             TEXT,
    CONSTRAINT chk_listino_date CHECK (data_fine IS NULL OR data_fine >= data_inizio)
);

CREATE INDEX idx_listino_lookup ON listino(committente_id, cliente_id, tipo_attivita_id);
CREATE INDEX idx_listino_date   ON listino(data_inizio, data_fine);


-- ============================================================
--  5. PROGETTI
--
--  tipo_budget:
--    STIMATO    → esiste stima in PROGETTO_STIMA; monitorare residuo
--    CONSUNTIVO → nessuna stima, solo consuntivazione
-- ============================================================
CREATE TABLE progetto (
    id                  SERIAL       PRIMARY KEY,
    committente_id      INT          NOT NULL REFERENCES committente(id) ON DELETE RESTRICT,
    cliente_id          INT          NOT NULL REFERENCES cliente(id)     ON DELETE RESTRICT,
    codice              VARCHAR(50),
    nome                VARCHAR(200) NOT NULL,
    descrizione         TEXT,
    tipo_budget         VARCHAR(15)  NOT NULL DEFAULT 'CONSUNTIVO'
                            CHECK (tipo_budget IN ('STIMATO','CONSUNTIVO')),
    data_inizio         DATE,
    data_fine_prevista  DATE,
    attivo              BOOLEAN      NOT NULL DEFAULT TRUE,
    note                TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progetto_committente ON progetto(committente_id);
CREATE INDEX idx_progetto_cliente     ON progetto(cliente_id);


-- ============================================================
--  6. STIMA PER PROGETTO (solo tipo_budget = 'STIMATO')
--     Una riga per ogni tipo di attività stimata nel progetto.
--     Il residuo = giorni_stimati - SUM(durata_minuti)/60/ore_per_giorno
--     calcolato via vista/query al momento del report.
-- ============================================================
CREATE TABLE progetto_stima (
    id               SERIAL        PRIMARY KEY,
    progetto_id      INT           NOT NULL REFERENCES progetto(id) ON DELETE CASCADE,
    tipo_attivita_id SMALLINT      NOT NULL REFERENCES tipo_attivita(id),
    giorni_stimati   NUMERIC(8,2)  NOT NULL CHECK (giorni_stimati > 0),
    ore_per_giorno   NUMERIC(4,2)  NOT NULL DEFAULT 8.00,
    UNIQUE (progetto_id, tipo_attivita_id)
);


-- ============================================================
--  7. ATTIVITÀ (log principale — cuore del sistema)
--
--  durata_minuti è colonna generata (STORED) da ora_inizio/ora_fine.
--  progetto_id NULL = attività senza progetto (solo committente/cliente).
-- ============================================================
CREATE TABLE attivita (
    id               BIGSERIAL    PRIMARY KEY,
    data_attivita    DATE         NOT NULL,
    ora_inizio       TIME         NOT NULL,
    ora_fine         TIME         NOT NULL,
    durata_minuti    INT          GENERATED ALWAYS AS (
                         (EXTRACT(HOUR   FROM ora_fine)::INT * 60 + EXTRACT(MINUTE FROM ora_fine)::INT) -
                         (EXTRACT(HOUR   FROM ora_inizio)::INT * 60 + EXTRACT(MINUTE FROM ora_inizio)::INT)
                     ) STORED,
    committente_id   INT          NOT NULL REFERENCES committente(id) ON DELETE RESTRICT,
    cliente_id       INT          NOT NULL REFERENCES cliente(id)     ON DELETE RESTRICT,
    progetto_id      INT          REFERENCES progetto(id)             ON DELETE RESTRICT,
    tipo_attivita_id SMALLINT     NOT NULL REFERENCES tipo_attivita(id),
    descrizione      TEXT,
    note_interne     TEXT,        -- non appare sui report al committente
    fatturabile      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_attivita_orario CHECK (ora_fine > ora_inizio),
    CONSTRAINT chk_attivita_cliente CHECK (
        -- il cliente deve appartenere al committente (enforced anche in app)
        TRUE
    )
);

CREATE INDEX idx_attivita_data        ON attivita(data_attivita);
CREATE INDEX idx_attivita_committente ON attivita(committente_id, data_attivita);
CREATE INDEX idx_attivita_cliente     ON attivita(cliente_id);
CREATE INDEX idx_attivita_progetto    ON attivita(progetto_id);
CREATE INDEX idx_attivita_tipo        ON attivita(tipo_attivita_id);


-- ============================================================
--  8. SPESE
--
--  tipo_spesa:
--    KM         → quantita = nr km; importo_unitario da listino (tipo_voce='KM')
--    AUTOSTRADA → pedaggi
--    MEZZI      → treni, aerei, taxi, etc.
--    VITTO      → pasti
--    ALLOGGIO   → hotel/b&b
--    ALTRO      → spese non categorizzate
-- ============================================================
CREATE TABLE spesa (
    id                  BIGSERIAL     PRIMARY KEY,
    attivita_id         BIGINT        NOT NULL REFERENCES attivita(id) ON DELETE CASCADE,
    tipo_spesa          VARCHAR(15)   NOT NULL
                            CHECK (tipo_spesa IN ('KM','AUTOSTRADA','MEZZI','VITTO','ALLOGGIO','ALTRO')),
    descrizione         VARCHAR(300),
    quantita            NUMERIC(10,3),   -- per KM: numero km
    importo_unitario    NUMERIC(10,4),   -- €/km dal listino, o costo unitario manuale
    importo_totale      NUMERIC(10,2)    NOT NULL CHECK (importo_totale >= 0),
    valuta              CHAR(3)          NOT NULL DEFAULT 'EUR',
    data_spesa          DATE             NOT NULL,
    rimborso_richiesto  BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spesa_attivita ON spesa(attivita_id);


-- ============================================================
--  9. ALLEGATI (giustificativi di spesa + allegati generici)
--
--  storage_key = chiave sul bucket (Vercel Blob / Cloudflare R2 / S3)
--  storage_url = URL pubblico o presigned per visualizzazione
--
--  Un allegato può essere legato a una spesa OPPURE
--  direttamente a un'attività (documenti generici).
-- ============================================================
CREATE TABLE allegato (
    id              BIGSERIAL    PRIMARY KEY,
    spesa_id        BIGINT       REFERENCES spesa(id)    ON DELETE CASCADE,
    attivita_id     BIGINT       REFERENCES attivita(id) ON DELETE CASCADE,
    nome_file       VARCHAR(255) NOT NULL,
    tipo_mime       VARCHAR(100),
    dimensione_bytes INT,
    storage_key     VARCHAR(500) NOT NULL,
    storage_url     VARCHAR(1000),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_allegato_link
        CHECK (spesa_id IS NOT NULL OR attivita_id IS NOT NULL)
);

CREATE INDEX idx_allegato_spesa    ON allegato(spesa_id);
CREATE INDEX idx_allegato_attivita ON allegato(attivita_id);


-- ============================================================
--  VISTE UTILI
-- ============================================================

-- Vista riepilogo ore per progetto con residuo stima
CREATE OR REPLACE VIEW v_residuo_progetto AS
SELECT
    p.id                                            AS progetto_id,
    p.nome                                          AS progetto,
    p.tipo_budget,
    ta.codice                                       AS tipo_attivita,
    ps.giorni_stimati,
    ps.ore_per_giorno,
    ps.giorni_stimati * ps.ore_per_giorno * 60      AS minuti_stimati,
    COALESCE(SUM(a.durata_minuti), 0)               AS minuti_erogati,
    ROUND(COALESCE(SUM(a.durata_minuti), 0) / 60.0 / ps.ore_per_giorno, 2)
                                                    AS giorni_erogati,
    ps.giorni_stimati - ROUND(COALESCE(SUM(a.durata_minuti), 0) / 60.0 / ps.ore_per_giorno, 2)
                                                    AS giorni_residui
FROM progetto p
JOIN progetto_stima ps ON ps.progetto_id = p.id
JOIN tipo_attivita ta  ON ta.id = ps.tipo_attivita_id
LEFT JOIN attivita a   ON a.progetto_id = p.id
                       AND a.tipo_attivita_id = ps.tipo_attivita_id
                       AND a.fatturabile = TRUE
WHERE p.tipo_budget = 'STIMATO'
GROUP BY p.id, p.nome, p.tipo_budget, ta.codice, ps.giorni_stimati, ps.ore_per_giorno;


-- Vista ore per giorno/settimana/mese (usata dal calendario)
CREATE OR REPLACE VIEW v_ore_calendario AS
SELECT
    data_attivita,
    DATE_TRUNC('week',  data_attivita)::DATE        AS settimana_inizio,
    DATE_TRUNC('month', data_attivita)::DATE        AS mese,
    committente_id,
    cliente_id,
    tipo_attivita_id,
    COUNT(*)                                        AS nr_attivita,
    SUM(durata_minuti)                              AS totale_minuti,
    ROUND(SUM(durata_minuti) / 60.0, 2)            AS totale_ore
FROM attivita
GROUP BY
    data_attivita,
    DATE_TRUNC('week',  data_attivita),
    DATE_TRUNC('month', data_attivita),
    committente_id,
    cliente_id,
    tipo_attivita_id;


-- ============================================================
--  FUNZIONE HELPER: risoluzione tariffa
--  Restituisce la tariffa vigente alla data per
--  committente/cliente/tipo_attivita (priorità come da spec).
-- ============================================================
CREATE OR REPLACE FUNCTION get_tariffa(
    p_committente_id   INT,
    p_cliente_id       INT,
    p_tipo_attivita_id SMALLINT,
    p_tipo_voce        VARCHAR,
    p_data             DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_tariffa NUMERIC;
BEGIN
    -- 1. Cliente + tipo specifico
    SELECT tariffa INTO v_tariffa
    FROM listino
    WHERE committente_id   = p_committente_id
      AND cliente_id       = p_cliente_id
      AND tipo_attivita_id = p_tipo_attivita_id
      AND tipo_voce        = p_tipo_voce
      AND data_inizio     <= p_data
      AND (data_fine IS NULL OR data_fine >= p_data)
    LIMIT 1;
    IF v_tariffa IS NOT NULL THEN RETURN v_tariffa; END IF;

    -- 2. Cliente, qualsiasi tipo attività
    SELECT tariffa INTO v_tariffa
    FROM listino
    WHERE committente_id   = p_committente_id
      AND cliente_id       = p_cliente_id
      AND tipo_attivita_id IS NULL
      AND tipo_voce        = p_tipo_voce
      AND data_inizio     <= p_data
      AND (data_fine IS NULL OR data_fine >= p_data)
    LIMIT 1;
    IF v_tariffa IS NOT NULL THEN RETURN v_tariffa; END IF;

    -- 3. Committente + tipo specifico (nessun cliente)
    SELECT tariffa INTO v_tariffa
    FROM listino
    WHERE committente_id   = p_committente_id
      AND cliente_id       IS NULL
      AND tipo_attivita_id = p_tipo_attivita_id
      AND tipo_voce        = p_tipo_voce
      AND data_inizio     <= p_data
      AND (data_fine IS NULL OR data_fine >= p_data)
    LIMIT 1;
    IF v_tariffa IS NOT NULL THEN RETURN v_tariffa; END IF;

    -- 4. Default committente
    SELECT tariffa INTO v_tariffa
    FROM listino
    WHERE committente_id   = p_committente_id
      AND cliente_id       IS NULL
      AND tipo_attivita_id IS NULL
      AND tipo_voce        = p_tipo_voce
      AND data_inizio     <= p_data
      AND (data_fine IS NULL OR data_fine >= p_data)
    LIMIT 1;

    RETURN v_tariffa;  -- può essere NULL se nessuna tariffa definita
END;
$$ LANGUAGE plpgsql;
