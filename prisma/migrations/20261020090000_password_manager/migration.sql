-- Password Manager: credenziali per cliente / sezione / ambiente, con voci di dettaglio
CREATE TABLE "credenziale" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "sezione" VARCHAR(200) NOT NULL,
    "ambiente" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credenziale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credenziale_voce" (
    "id" SERIAL NOT NULL,
    "credenziale_id" INTEGER NOT NULL,
    "descrizione" VARCHAR(500),
    "utente" VARCHAR(500),
    "password" VARCHAR(1000),
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credenziale_voce_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credenziale_cliente_id_idx" ON "credenziale"("cliente_id");
CREATE INDEX "credenziale_voce_credenziale_id_idx" ON "credenziale_voce"("credenziale_id");

ALTER TABLE "credenziale" ADD CONSTRAINT "credenziale_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credenziale_voce" ADD CONSTRAINT "credenziale_voce_credenziale_id_fkey" FOREIGN KEY ("credenziale_id") REFERENCES "credenziale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
