-- CreateTable
CREATE TABLE "backup_log" (
    "id" SERIAL NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500),
    "file_size_bytes" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_log_pkey" PRIMARY KEY ("id")
);
