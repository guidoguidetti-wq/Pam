-- Password Manager: un allegato facoltativo per ogni riga di credenziali
ALTER TABLE "credenziale_voce" ADD COLUMN "file_nome" VARCHAR(500);
ALTER TABLE "credenziale_voce" ADD COLUMN "file_url" TEXT;
ALTER TABLE "credenziale_voce" ADD COLUMN "file_key" TEXT;
ALTER TABLE "credenziale_voce" ADD COLUMN "file_size" INTEGER;
