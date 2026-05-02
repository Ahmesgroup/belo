-- Add PlanConfig table for admin-editable plan prices

CREATE TABLE "PlanConfig" (
    "id"              TEXT NOT NULL,
    "plan"            TEXT NOT NULL,
    "priceFcfa"       INTEGER NOT NULL DEFAULT 0,
    "priceEur"        INTEGER NOT NULL DEFAULT 0,
    "priceUsd"        INTEGER NOT NULL DEFAULT 0,
    "priceFcfaAnnual" INTEGER NOT NULL DEFAULT 0,
    "priceEurAnnual"  INTEGER NOT NULL DEFAULT 0,
    "priceUsdAnnual"  INTEGER NOT NULL DEFAULT 0,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "updatedBy"       TEXT,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanConfig_plan_key" ON "PlanConfig"("plan");
