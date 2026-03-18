-- CreateEnum
CREATE TYPE "TipoVoceListino" AS ENUM ('ORARIO', 'GIORNALIERO', 'KM', 'RIMBORSO');

-- CreateEnum
CREATE TYPE "TipoBudget" AS ENUM ('STIMATO', 'CONSUNTIVO');

-- CreateEnum
CREATE TYPE "TipoSpesa" AS ENUM ('KM', 'AUTOSTRADA', 'MEZZI', 'VITTO', 'ALLOGGIO', 'ALTRO');

-- CreateTable
CREATE TABLE "tipo_attivita" (
    "id" SMALLSERIAL NOT NULL,
    "codice" VARCHAR(10) NOT NULL,
    "descrizione" VARCHAR(100) NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_attivita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committente" (
    "id" SERIAL NOT NULL,
    "ragione_sociale" VARCHAR(200) NOT NULL,
    "partita_iva" VARCHAR(20),
    "codice_fiscale" VARCHAR(16),
    "indirizzo" TEXT,
    "email" VARCHAR(150),
    "telefono" VARCHAR(30),
    "note" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" SERIAL NOT NULL,
    "committente_id" INTEGER NOT NULL,
    "ragione_sociale" VARCHAR(200) NOT NULL,
    "partita_iva" VARCHAR(20),
    "indirizzo" TEXT,
    "email" VARCHAR(150),
    "note" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listino" (
    "id" SERIAL NOT NULL,
    "committente_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "tipo_attivita_id" SMALLINT,
    "tipo_voce" "TipoVoceListino" NOT NULL,
    "tariffa" DECIMAL(10,4) NOT NULL,
    "valuta" CHAR(3) NOT NULL DEFAULT 'EUR',
    "ore_giornata" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "data_inizio" DATE NOT NULL,
    "data_fine" DATE,
    "note" TEXT,

    CONSTRAINT "listino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progetto" (
    "id" SERIAL NOT NULL,
    "committente_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "codice" VARCHAR(50),
    "nome" VARCHAR(200) NOT NULL,
    "descrizione" TEXT,
    "tipo_budget" "TipoBudget" NOT NULL DEFAULT 'CONSUNTIVO',
    "data_inizio" DATE,
    "data_fine_prevista" DATE,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progetto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progetto_stima" (
    "id" SERIAL NOT NULL,
    "progetto_id" INTEGER NOT NULL,
    "tipo_attivita_id" SMALLINT NOT NULL,
    "giorni_stimati" DECIMAL(8,2) NOT NULL,
    "ore_per_giorno" DECIMAL(4,2) NOT NULL DEFAULT 8.00,

    CONSTRAINT "progetto_stima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attivita" (
    "id" BIGSERIAL NOT NULL,
    "data_attivita" DATE NOT NULL,
    "ora_inizio" TIME NOT NULL,
    "ora_fine" TIME NOT NULL,
    "committente_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "progetto_id" INTEGER,
    "tipo_attivita_id" SMALLINT NOT NULL,
    "descrizione" TEXT,
    "note_interne" TEXT,
    "fatturabile" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attivita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spesa" (
    "id" BIGSERIAL NOT NULL,
    "attivita_id" BIGINT NOT NULL,
    "tipo_spesa" "TipoSpesa" NOT NULL,
    "descrizione" VARCHAR(300),
    "quantita" DECIMAL(10,3),
    "importo_unitario" DECIMAL(10,4),
    "importo_totale" DECIMAL(10,2) NOT NULL,
    "valuta" CHAR(3) NOT NULL DEFAULT 'EUR',
    "data_spesa" DATE NOT NULL,
    "rimborso_richiesto" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegato" (
    "id" BIGSERIAL NOT NULL,
    "spesa_id" BIGINT,
    "attivita_id" BIGINT,
    "nome_file" VARCHAR(255) NOT NULL,
    "tipo_mime" VARCHAR(100),
    "dimensione_bytes" INTEGER,
    "storage_key" VARCHAR(500) NOT NULL,
    "storage_url" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allegato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_attivita_codice_key" ON "tipo_attivita"("codice");

-- CreateIndex
CREATE INDEX "cliente_committente_id_idx" ON "cliente"("committente_id");

-- CreateIndex
CREATE INDEX "listino_committente_id_cliente_id_tipo_attivita_id_idx" ON "listino"("committente_id", "cliente_id", "tipo_attivita_id");

-- CreateIndex
CREATE INDEX "progetto_committente_id_idx" ON "progetto"("committente_id");

-- CreateIndex
CREATE INDEX "progetto_cliente_id_idx" ON "progetto"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "progetto_stima_progetto_id_tipo_attivita_id_key" ON "progetto_stima"("progetto_id", "tipo_attivita_id");

-- CreateIndex
CREATE INDEX "attivita_data_attivita_idx" ON "attivita"("data_attivita");

-- CreateIndex
CREATE INDEX "attivita_committente_id_data_attivita_idx" ON "attivita"("committente_id", "data_attivita");

-- CreateIndex
CREATE INDEX "attivita_cliente_id_idx" ON "attivita"("cliente_id");

-- CreateIndex
CREATE INDEX "attivita_progetto_id_idx" ON "attivita"("progetto_id");

-- CreateIndex
CREATE INDEX "spesa_attivita_id_idx" ON "spesa"("attivita_id");

-- CreateIndex
CREATE INDEX "allegato_spesa_id_idx" ON "allegato"("spesa_id");

-- CreateIndex
CREATE INDEX "allegato_attivita_id_idx" ON "allegato"("attivita_id");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_committente_id_fkey" FOREIGN KEY ("committente_id") REFERENCES "committente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listino" ADD CONSTRAINT "listino_committente_id_fkey" FOREIGN KEY ("committente_id") REFERENCES "committente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listino" ADD CONSTRAINT "listino_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listino" ADD CONSTRAINT "listino_tipo_attivita_id_fkey" FOREIGN KEY ("tipo_attivita_id") REFERENCES "tipo_attivita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progetto" ADD CONSTRAINT "progetto_committente_id_fkey" FOREIGN KEY ("committente_id") REFERENCES "committente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progetto" ADD CONSTRAINT "progetto_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progetto_stima" ADD CONSTRAINT "progetto_stima_progetto_id_fkey" FOREIGN KEY ("progetto_id") REFERENCES "progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progetto_stima" ADD CONSTRAINT "progetto_stima_tipo_attivita_id_fkey" FOREIGN KEY ("tipo_attivita_id") REFERENCES "tipo_attivita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attivita" ADD CONSTRAINT "attivita_committente_id_fkey" FOREIGN KEY ("committente_id") REFERENCES "committente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attivita" ADD CONSTRAINT "attivita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attivita" ADD CONSTRAINT "attivita_progetto_id_fkey" FOREIGN KEY ("progetto_id") REFERENCES "progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attivita" ADD CONSTRAINT "attivita_tipo_attivita_id_fkey" FOREIGN KEY ("tipo_attivita_id") REFERENCES "tipo_attivita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spesa" ADD CONSTRAINT "spesa_attivita_id_fkey" FOREIGN KEY ("attivita_id") REFERENCES "attivita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegato" ADD CONSTRAINT "allegato_spesa_id_fkey" FOREIGN KEY ("spesa_id") REFERENCES "spesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegato" ADD CONSTRAINT "allegato_attivita_id_fkey" FOREIGN KEY ("attivita_id") REFERENCES "attivita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
