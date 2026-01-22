-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorAlertSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filterSignature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorAlertSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorAlertState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filterSignature" TEXT NOT NULL,
    "prevCoinIdsJson" TEXT NOT NULL DEFAULT '[]',
    "lastSignatureSeenAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlertState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframesJson" TEXT NOT NULL,
    "thresholdsJson" TEXT NOT NULL,
    "baselineN" INTEGER NOT NULL DEFAULT 20,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT,
    "threshold" INTEGER,
    "ratio" DOUBLE PRECISION,
    "currentVol" DOUBLE PRECISION,
    "baselineVol" DOUBLE PRECISION,
    "monitorFiltersJson" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "deliveredChannelsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'triggered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddedSymbol" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddedSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_userId_key" ON "TelegramLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlertSettings_userId_filterSignature_key" ON "MonitorAlertSettings"("userId", "filterSignature");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlertState_userId_filterSignature_key" ON "MonitorAlertState"("userId", "filterSignature");

-- CreateIndex
CREATE UNIQUE INDEX "UserAddedSymbol_userId_symbol_key" ON "UserAddedSymbol"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertSettings" ADD CONSTRAINT "MonitorAlertSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertState" ADD CONSTRAINT "MonitorAlertState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddedSymbol" ADD CONSTRAINT "UserAddedSymbol_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
