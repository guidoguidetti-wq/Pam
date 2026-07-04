-- CreateTable
CREATE TABLE "enticategorie" (
    "id" SERIAL NOT NULL,
    "categoria" VARCHAR(100) NOT NULL,
    "inestratto" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enticategorie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enticategorie_categoria_key" ON "enticategorie"("categoria");

-- Seed: popola con tutte le categorie già registrate sugli enti esistenti
INSERT INTO "enticategorie" ("categoria", "inestratto")
SELECT DISTINCT "categoria", true
FROM "ente"
WHERE "categoria" IS NOT NULL AND btrim("categoria") <> ''
ON CONFLICT ("categoria") DO NOTHING;
