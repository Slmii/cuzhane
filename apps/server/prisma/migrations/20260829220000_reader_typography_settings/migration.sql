-- E2a, the reader's settings sheet: which digits the verse ornaments carry, and which
-- Arabic face the text is set in. Both apply to every bab, so they live on the person
-- rather than on a group.
--
-- The fonts are named after the script rather than the file, so shipping a different
-- family for `naskh` later is a client change and not a migration.

CREATE TYPE "ReaderNumerals" AS ENUM ('arabic', 'latin');
CREATE TYPE "ReaderArabicFont" AS ENUM ('naskh', 'amiri', 'scheherazade');

ALTER TABLE "UserSettings"
    ADD COLUMN "readerNumerals" "ReaderNumerals" NOT NULL DEFAULT 'arabic',
    ADD COLUMN "readerArabicFont" "ReaderArabicFont" NOT NULL DEFAULT 'naskh';
