-- CreateTable (solo additiva)
CREATE TABLE "reminder" (
    "id" SERIAL NOT NULL,
    "testo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);
