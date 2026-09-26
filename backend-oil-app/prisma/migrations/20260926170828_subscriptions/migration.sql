-- CreateEnum
CREATE TYPE "PlanId" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "Subscription" (
    "userId" UUID NOT NULL,
    "plan" "PlanId" NOT NULL DEFAULT 'FREE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
