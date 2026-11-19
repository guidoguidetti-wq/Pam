-- Password Manager: cifratura lato browser (solo modifiche additive / allargamenti di tipo)

-- Il testo cifrato è più lungo del testo in chiaro: VARCHAR -> TEXT (nessuna perdita di dati)
ALTER TABLE "credenziale_voce" ALTER COLUMN "utente" TYPE TEXT;
ALTER TABLE "credenziale_voce" ALTER COLUMN "password" TYPE TEXT;

-- Allegati: indica se il file su Blob è cifrato
ALTER TABLE "credenziale_voce" ADD COLUMN "file_cifrato" BOOLEAN NOT NULL DEFAULT false;

-- Configurazione cassaforte (riga unica)
CREATE TABLE "vault_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "salt" TEXT NOT NULL,
    "iterazioni" INTEGER NOT NULL,
    "chiave_cifrata" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_config_pkey" PRIMARY KEY ("id")
);
