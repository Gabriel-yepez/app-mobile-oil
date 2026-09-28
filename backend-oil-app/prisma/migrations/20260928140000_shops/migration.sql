-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "nameKey" VARCHAR(60) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_nameKey_key" ON "Shop"("nameKey");

-- CreateIndex
CREATE INDEX "Shop_name_idx" ON "Shop"("name");

-- Los 6 talleres con los que la app venía funcionando. `createdBy` en NULL los
-- marca como semilla: no cuentan contra el tope diario de nadie.
INSERT INTO "Shop" ("id", "name", "nameKey", "createdBy", "createdAt") VALUES
  (gen_random_uuid(), 'Lubricantes El Marqués',     'LUBRICANTESELMARQUES',     NULL, NOW()),
  (gen_random_uuid(), 'Servicar Las Mercedes',      'SERVICARLASMERCEDES',      NULL, NOW()),
  (gen_random_uuid(), 'Tecnicentro Cordero',        'TECNICENTROCORDERO',       NULL, NOW()),
  (gen_random_uuid(), 'Auto Express La Castellana', 'AUTOEXPRESSLACASTELLANA',  NULL, NOW()),
  (gen_random_uuid(), 'Lubricantes Sambil',         'LUBRICANTESSAMBIL',        NULL, NOW()),
  (gen_random_uuid(), 'Mecánica La Trinidad',       'MECANICALATRINIDAD',       NULL, NOW());
