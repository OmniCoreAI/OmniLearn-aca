"""One-shot helper to create cms_news if alembic history is out of sync."""
import psycopg2

DSN = "postgresql://omnilearn:omnilearn@localhost:5433/omnilearn"

SQL = """
CREATE TABLE IF NOT EXISTS cms_news (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  news_uuid VARCHAR NOT NULL DEFAULT '',
  title VARCHAR NOT NULL,
  slug VARCHAR NOT NULL DEFAULT '',
  excerpt VARCHAR NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_image VARCHAR NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at VARCHAR NULL,
  created_by INTEGER NULL REFERENCES "user"(id) ON DELETE SET NULL,
  creation_date VARCHAR NOT NULL DEFAULT '',
  update_date VARCHAR NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_cms_news_org_id ON cms_news (org_id);
CREATE INDEX IF NOT EXISTS ix_cms_news_news_uuid ON cms_news (news_uuid);
CREATE INDEX IF NOT EXISTS ix_cms_news_slug ON cms_news (slug);
CREATE INDEX IF NOT EXISTS ix_cms_news_org_published_at ON cms_news (org_id, published, published_at);
"""


def main() -> None:
    conn = psycopg2.connect(DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(SQL)
            cur.execute(
                """
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_cms_news_org_slug'
                """
            )
            if cur.fetchone() is None:
                cur.execute(
                    "ALTER TABLE cms_news ADD CONSTRAINT uq_cms_news_org_slug UNIQUE (org_id, slug)"
                )
            cur.execute("SELECT to_regclass('public.cms_news')")
            print("table:", cur.fetchone()[0])
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name='cms_news' ORDER BY ordinal_position"
            )
            print("columns:", [r[0] for r in cur.fetchall()])
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
