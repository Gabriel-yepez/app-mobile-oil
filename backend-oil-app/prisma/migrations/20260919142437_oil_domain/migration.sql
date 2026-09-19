-- CreateEnum
CREATE TYPE "VehicleKind" AS ENUM ('CAR', 'MOTO');

-- CreateEnum
CREATE TYPE "KmRateSource" AS ENUM ('DECLARED', 'MEASURED');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('OIL_CHANGE', 'MANUAL');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "VehicleKind" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "plate" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "kmPerDay" DECIMAL(6,2) NOT NULL,
    "kmPerDaySource" "KmRateSource" NOT NULL DEFAULT 'DECLARED',
    "lastChangeKm" INTEGER,
    "lastChangeAt" TIMESTAMP(3),
    "nextChangeKm" INTEGER,
    "nextChangeDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OilChange" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "km" INTEGER NOT NULL,
    "intervalKm" INTEGER NOT NULL,
    "intervalMonths" INTEGER NOT NULL,
    "oilBrand" TEXT NOT NULL,
    "oilTag" TEXT NOT NULL,
    "oilViscosity" TEXT NOT NULL,
    "oilSynthetic" BOOLEAN NOT NULL,
    "shop" TEXT,
    "costUsd" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OilChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdometerReading" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "km" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "source" "ReadingSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdometerReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_userId_plate_key" ON "Vehicle"("userId", "plate");

-- CreateIndex
CREATE INDEX "OilChange_vehicleId_changedAt_idx" ON "OilChange"("vehicleId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "OdometerReading_vehicleId_readAt_idx" ON "OdometerReading"("vehicleId", "readAt" DESC);

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OilChange" ADD CONSTRAINT "OilChange_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdometerReading" ADD CONSTRAINT "OdometerReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
