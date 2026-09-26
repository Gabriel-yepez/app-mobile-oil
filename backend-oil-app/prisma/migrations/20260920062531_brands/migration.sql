-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "kind" "VehicleKind" NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "nameKey" VARCHAR(40) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Brand_kind_name_idx" ON "Brand"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_kind_nameKey_key" ON "Brand"("kind", "nameKey");

-- Las 18 marcas con las que la app venía funcionando. `createdBy` en NULL las
-- marca como semilla: no cuentan contra el tope diario de nadie.
INSERT INTO "Brand" ("id", "kind", "name", "nameKey", "createdBy", "createdAt") VALUES
  (gen_random_uuid(), 'CAR',  'Toyota',        'TOYOTA',       NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Chevrolet',     'CHEVROLET',    NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Ford',          'FORD',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Hyundai',       'HYUNDAI',      NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Kia',           'KIA',          NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Renault',       'RENAULT',      NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Fiat',          'FIAT',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Jeep',          'JEEP',         NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Nissan',        'NISSAN',       NULL, NOW()),
  (gen_random_uuid(), 'CAR',  'Mitsubishi',    'MITSUBISHI',   NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Bera',          'BERA',         NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Empire Keeway', 'EMPIREKEEWAY', NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'MD',            'MD',           NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Yamaha',        'YAMAHA',       NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Suzuki',        'SUZUKI',       NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Honda',         'HONDA',        NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'AVA',           'AVA',          NULL, NOW()),
  (gen_random_uuid(), 'MOTO', 'Skygo',         'SKYGO',        NULL, NOW());
