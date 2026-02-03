-- Add Telegram link code fields for secure pairing
ALTER TABLE "TelegramLink" ADD COLUMN "linkCode" TEXT;
ALTER TABLE "TelegramLink" ADD COLUMN "linkCodeExpiresAt" TIMESTAMP(3);
