-- CreateTable
CREATE TABLE "ente" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "nome_norm" VARCHAR(200) NOT NULL,
    "categoria" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conto_banca" (
    "id" SERIAL NOT NULL,
    "banca" VARCHAR(100) NOT NULL,
    "numero_conto" VARCHAR(50) NOT NULL,
    "iban" VARCHAR(34),
    "intestatario" VARCHAR(200),
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conto_banca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimento_bancario" (
    "id" BIGSERIAL NOT NULL,
    "conto_id" INTEGER NOT NULL,
    "data_operazione" DATE NOT NULL,
    "data_valuta" DATE,
    "descrizione" TEXT NOT NULL,
    "ente_id" INTEGER,
    "importo" DECIMAL(12,2) NOT NULL,
    "categoria" VARCHAR(50),
    "stato" VARCHAR(30),
    "hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimento_bancario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ente_nome_norm_key" ON "ente"("nome_norm");

-- CreateIndex
CREATE INDEX "movimento_bancario_data_operazione_idx" ON "movimento_bancario"("data_operazione");

-- CreateIndex
CREATE INDEX "movimento_bancario_ente_id_idx" ON "movimento_bancario"("ente_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimento_bancario_conto_id_hash_key" ON "movimento_bancario"("conto_id", "hash");

-- AddForeignKey
ALTER TABLE "movimento_bancario" ADD CONSTRAINT "movimento_bancario_conto_id_fkey" FOREIGN KEY ("conto_id") REFERENCES "conto_banca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_bancario" ADD CONSTRAINT "movimento_bancario_ente_id_fkey" FOREIGN KEY ("ente_id") REFERENCES "ente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
