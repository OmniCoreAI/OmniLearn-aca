# Academy (EACA) legacy database dumps

SQL Server dumps from the Academy’s old Sawa/EACA LMS, used as the source for migrating into OmniLearn.

## Files

| File | Description |
|------|-------------|
| `Sawa_LTD.sql` | UTF-8 schema script for `EACA_V2_Stage_23102024` (prefer this for parsing) |
| `scriptDb.sql` | UTF-16 schema script for `EACA_V2` (nearly identical; 2 extra tables) |
| `SnapShotDb.bak` | SQL Server backup with **real data** — restore on SQL Server to ETL |
| `TableRowCount.xlsx` | Per-table row counts (~6.9M total rows, 221 non-empty tables) |

## Migration documentation

Full analysis (important tables, relationships, OmniLearn mapping, phased plan, day-to-day flows):

→ [`docs/notes/academy-eaca-migration.md`](../docs/notes/academy-eaca-migration.md)  
  - §2.6 — old FK model (including empty tables)  
  - §2.7 — business logic & day-to-day flows (enroll → attend → exam → certify)

Every declared foreign key (2,243 constraints), hub-by-hub detail, and empty-table links:

→ [`docs/notes/academy-eaca-old-db-relationships.md`](../docs/notes/academy-eaca-old-db-relationships.md)

## Quick naming trap

In the old DB: **courses = `GENTypes`**, lessons = `GENItems`, exams = `GENPollCategories`, class offerings = `GENClassrooms` (VCR), students = `GENContacts`. Attendance = `Classroom_Attendance` (+ `OTP_Attendance` / `Zoom_Session`); OmniLearn target is QR check-in (in-person) and meeting participant sync (online).
