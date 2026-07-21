"""Ensure cms_news.images / cms_news.videos columns exist."""
import psycopg2

DSN = "postgresql://omnilearn:omnilearn@localhost:5433/omnilearn"

SQL = """
ALTER TABLE cms_news
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cms_news
  ADD COLUMN IF NOT EXISTS videos JSONB NOT NULL DEFAULT '[]'::jsonb;
"""


def main() -> None:
    conn = psycopg2.connect(DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(SQL)
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'cms_news'
                  AND column_name IN ('images', 'videos')
                ORDER BY column_name
                """
            )
            print("columns:", [r[0] for r in cur.fetchall()])
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
