-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "discordUserId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" UUID NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'IDX',
    "sector" TEXT,
    "board" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "yahooSymbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,4) NOT NULL,
    "high" DECIMAL(18,4) NOT NULL,
    "low" DECIMAL(18,4) NOT NULL,
    "close" DECIMAL(18,4) NOT NULL,
    "adjClose" DECIMAL(18,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "foreignBuyVolume" BIGINT NOT NULL DEFAULT 0,
    "foreignSellVolume" BIGINT NOT NULL DEFAULT 0,
    "foreignBuyValue" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "foreignSellValue" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'yahoo',
    "isAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorSnapshot" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT '1D',
    "indicatorsJson" JSONB NOT NULL,
    "ohlcvRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundamentalSnapshot" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "pbv" DECIMAL(18,4),
    "per" DECIMAL(18,4),
    "roe" DECIMAL(18,4),
    "eps" DECIMAL(18,4),
    "revenue" DECIMAL(24,4),
    "netIncome" DECIMAL(24,4),
    "divYield" DECIMAL(18,4),
    "marketCap" DECIMAL(24,4),
    "source" TEXT NOT NULL DEFAULT 'yahoo',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundamentalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerSummary" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "brokerCode" TEXT NOT NULL,
    "investorType" TEXT NOT NULL DEFAULT 'LOCAL',
    "buyFreq" INTEGER NOT NULL DEFAULT 0,
    "buyVolume" BIGINT NOT NULL DEFAULT 0,
    "buyValue" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "sellFreq" INTEGER NOT NULL DEFAULT 0,
    "sellVolume" BIGINT NOT NULL DEFAULT 0,
    "sellValue" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'scraper',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notifPrefsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" UUID NOT NULL,
    "watchlistId" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "conditionJson" JSONB NOT NULL,
    "repeat" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "strategyId" UUID,
    "strategyType" TEXT DEFAULT 'SWING',
    "source" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "reasonJson" JSONB NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "artifactPath" TEXT,
    "trainedAt" TIMESTAMP(3),
    "metricsJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'EXPERIMENTAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLPrediction" (
    "id" UUID NOT NULL,
    "signalId" UUID,
    "stockId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "featuresHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL DEFAULT 'SWING',
    "stockIds" TEXT[],
    "entryRulesJson" JSONB NOT NULL,
    "exitRulesJson" JSONB NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT '1D',
    "riskParamsJson" JSONB NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SIGNAL_ONLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfig" (
    "id" UUID NOT NULL,
    "strategyId" UUID,
    "guildId" TEXT,
    "notifyChannelId" TEXT,
    "adminChannelId" TEXT,
    "ownerDiscordId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SIGNAL_ONLY',
    "status" TEXT NOT NULL DEFAULT 'STOPPED',
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "signalId" UUID,
    "stockId" UUID NOT NULL,
    "side" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pnl" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requestId" TEXT NOT NULL,
    "decisionLogJson" JSONB NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "avgEntry" DECIMAL(18,4) NOT NULL,
    "currentValue" DECIMAL(18,4) NOT NULL,
    "unrealizedPnl" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" UUID NOT NULL,
    "strategyId" UUID,
    "balance" DECIMAL(18,4) NOT NULL,
    "initialBalance" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" UUID NOT NULL,
    "alertId" UUID,
    "signalId" UUID,
    "type" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contextJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenerPreset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenerPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "date" TIMESTAMP(3) NOT NULL,
    "isTradingDay" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "CorporateAction" (
    "id" UUID NOT NULL,
    "stockId" UUID NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cumDate" TIMESTAMP(3) NOT NULL,
    "exDate" TIMESTAMP(3) NOT NULL,
    "recordDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" UUID NOT NULL,
    "stockId" UUID,
    "ticker" TEXT,
    "relatedTickers" TEXT[],
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "aiSummary" TEXT,
    "aiSentiment" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalLog" (
    "id" UUID NOT NULL,
    "signalId" UUID,
    "strategyType" TEXT NOT NULL DEFAULT 'SWING',
    "ticker" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" JSONB NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_yahooSymbol_key" ON "Stock"("yahooSymbol");

-- CreateIndex
CREATE INDEX "Stock_isActive_idx" ON "Stock"("isActive");

-- CreateIndex
CREATE INDEX "PriceBar_stockId_timestamp_idx" ON "PriceBar"("stockId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_stockId_timestamp_key" ON "PriceBar"("stockId", "timestamp");

-- CreateIndex
CREATE INDEX "IndicatorSnapshot_stockId_date_idx" ON "IndicatorSnapshot"("stockId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorSnapshot_stockId_date_timeframe_key" ON "IndicatorSnapshot"("stockId", "date", "timeframe");

-- CreateIndex
CREATE INDEX "FundamentalSnapshot_stockId_asOfDate_idx" ON "FundamentalSnapshot"("stockId", "asOfDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FundamentalSnapshot_stockId_asOfDate_key" ON "FundamentalSnapshot"("stockId", "asOfDate");

-- CreateIndex
CREATE INDEX "BrokerSummary_stockId_date_idx" ON "BrokerSummary"("stockId", "date" DESC);

-- CreateIndex
CREATE INDEX "BrokerSummary_date_idx" ON "BrokerSummary"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerSummary_stockId_date_brokerCode_key" ON "BrokerSummary"("stockId", "date", "brokerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_name_key" ON "Watchlist"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_stockId_key" ON "WatchlistItem"("watchlistId", "stockId");

-- CreateIndex
CREATE INDEX "Alert_userId_status_idx" ON "Alert"("userId", "status");

-- CreateIndex
CREATE INDEX "Alert_stockId_idx" ON "Alert"("stockId");

-- CreateIndex
CREATE INDEX "Signal_stockId_createdAt_idx" ON "Signal"("stockId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Signal_status_idx" ON "Signal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_stockId_direction_source_createdAt_key" ON "Signal"("stockId", "direction", "source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Model_name_version_key" ON "Model"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MLPrediction_signalId_key" ON "MLPrediction"("signalId");

-- CreateIndex
CREATE INDEX "MLPrediction_modelId_createdAt_idx" ON "MLPrediction"("modelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MLPrediction_stockId_idx" ON "MLPrediction"("stockId");

-- CreateIndex
CREATE INDEX "Strategy_userId_isActive_idx" ON "Strategy"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BotConfig_strategyId_key" ON "BotConfig"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_requestId_key" ON "Trade"("requestId");

-- CreateIndex
CREATE INDEX "Trade_strategyId_openedAt_idx" ON "Trade"("strategyId", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "Trade_stockId_idx" ON "Trade"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_strategyId_stockId_mode_key" ON "Position"("strategyId", "stockId", "mode");

-- CreateIndex
CREATE INDEX "AlertEvent_status_idx" ON "AlertEvent"("status");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LogEntry_service_createdAt_idx" ON "LogEntry"("service", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LogEntry_level_idx" ON "LogEntry"("level");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenerPreset_userId_name_key" ON "ScreenerPreset"("userId", "name");

-- CreateIndex
CREATE INDEX "CorporateAction_ticker_cumDate_idx" ON "CorporateAction"("ticker", "cumDate");

-- CreateIndex
CREATE INDEX "CorporateAction_cumDate_idx" ON "CorporateAction"("cumDate");

-- CreateIndex
CREATE UNIQUE INDEX "News_url_key" ON "News"("url");

-- CreateIndex
CREATE INDEX "News_ticker_publishedAt_idx" ON "News"("ticker", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "News_publishedAt_idx" ON "News"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "SignalLog_ticker_matchedAt_idx" ON "SignalLog"("ticker", "matchedAt" DESC);

-- CreateIndex
CREATE INDEX "SignalLog_strategyType_idx" ON "SignalLog"("strategyType");

-- AddForeignKey
ALTER TABLE "PriceBar" ADD CONSTRAINT "PriceBar_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorSnapshot" ADD CONSTRAINT "IndicatorSnapshot_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundamentalSnapshot" ADD CONSTRAINT "FundamentalSnapshot_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSummary" ADD CONSTRAINT "BrokerSummary_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLPrediction" ADD CONSTRAINT "MLPrediction_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLPrediction" ADD CONSTRAINT "MLPrediction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLPrediction" ADD CONSTRAINT "MLPrediction_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfig" ADD CONSTRAINT "BotConfig_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAccount" ADD CONSTRAINT "PaperAccount_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenerPreset" ADD CONSTRAINT "ScreenerPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateAction" ADD CONSTRAINT "CorporateAction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
