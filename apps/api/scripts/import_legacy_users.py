#!/usr/bin/env python3
"""Import overlapping legacy users from Users.csv + Results.csv into OmniLearn.

Joins on legacy user GUID:
  Users.csv   — profile rows (no header; inferred columns)
  Results.csv — membership pairs (user_id, org_id)

Only users present in BOTH files are imported.

Usage (from apps/api):
  python scripts/import_legacy_users.py --dry-run
  python scripts/import_legacy_users.py --apply

Defaults:
  Users:   %USERPROFILE%/OneDrive/Desktop/Users.csv
  Results: %USERPROFILE%/OneDrive/Desktop/Results.csv
  DB:      postgresql://omnilearn:omnilearn@localhost:5433/omnilearn
  Org:     OmniLearn org id 1 (slug default)
  Role:    Trainee (role id 4)

Writes temporary passwords to:
  scripts/output/legacy_import_passwords.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

# apps/api on sys.path
API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from src.security.security import security_hash_password
from src.services.security.password_validation import generate_temporary_password

DEFAULT_MEMBER_ROLE_ID = 4  # Trainee / role_global_user
DEFAULT_ORG_ID = 1

# Users.csv column indexes (no header)
COL_ID = 0
COL_FULL_NAME = 1
COL_GENDER = 2
COL_BIRTH_DATE = 5
COL_LEGACY_ORG = 12
COL_EMAIL = 14
COL_PHONE_OR_NID = 15


def default_desktop(*parts: str) -> Path:
    home = Path(os.environ.get("USERPROFILE") or Path.home())
    return home / "OneDrive" / "Desktop" / Path(*parts)


def get_database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        os.environ.get(
            "OMNILEARN_DB_URL",
            "postgresql://omnilearn:omnilearn@localhost:5433/omnilearn",
        ),
    )


def is_null(value: str | None) -> bool:
    return value is None or value.strip() in ("", "NULL", "null", "None")


def cell(row: list[str], index: int) -> str:
    if index >= len(row):
        return ""
    value = (row[index] or "").strip()
    return "" if is_null(value) else value


def map_gender(raw: str) -> str | None:
    value = raw.strip().lower()
    if not value:
        return None
    if value in ("ذكر", "male", "m"):
        return "male"
    if value in ("أنثي", "انثي", "أنثى", "انثى", "female", "f"):
        return "female"
    if value in ("other", "آخر"):
        return "other"
    return None


def split_phone_or_national_id(raw: str) -> tuple[str | None, str | None]:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None, None
    # Egyptian mobile: starts with 01 and length 10–11
    if digits.startswith("01") and 10 <= len(digits) <= 11:
        return digits, None
    # National ID typically 14 digits
    if len(digits) >= 14:
        return None, digits
    # Ambiguous shorter numeric — keep as phone
    if len(digits) <= 15:
        return digits, None
    return None, digits


def split_arabic_name(full_name: str) -> tuple[str, str]:
    parts = [p for p in full_name.split() if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def normalize_birth_date(raw: str) -> str | None:
    if not raw:
        return None
    # "1968-12-04 00:00:00.000" -> "1968-12-04"
    date_part = raw.split(" ")[0].strip()
    try:
        datetime.strptime(date_part, "%Y-%m-%d")
    except ValueError:
        return None
    return date_part


def username_from_email(email: str, legacy_id: str) -> str:
    local = email.split("@", 1)[0].strip().lower()
    local = re.sub(r"[^a-z0-9._-]", "", local)
    if len(local) >= 2:
        return local[:40]
    return f"user_{legacy_id.replace('-', '')[:12]}"


def load_users_csv(path: Path) -> dict[str, list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    by_id: dict[str, list[str]] = {}
    for row in rows:
        if not row:
            continue
        uid = cell(row, COL_ID)
        if uid:
            by_id[uid] = row
    return by_id


def load_results_csv(path: Path) -> dict[str, list[str]]:
    """Map user_id -> list of legacy org ids."""
    memberships: dict[str, list[str]] = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    for row in rows:
        if len(row) < 2:
            continue
        uid = cell(row, 0)
        org = cell(row, 1)
        if not uid or not org:
            continue
        memberships.setdefault(uid, [])
        if org not in memberships[uid]:
            memberships[uid].append(org)
    return memberships


def build_extra_metadata(
    *,
    legacy_user_id: str,
    legacy_org_ids: list[str],
    full_name: str,
    gender: str | None,
    birth_date: str | None,
    phone: str | None,
    national_id: str | None,
) -> dict:
    meta: dict = {
        "legacy_user_id": legacy_user_id,
        "legacy_org_ids": legacy_org_ids,
        "import_source": "Users.csv+Results.csv",
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }
    if full_name:
        meta["full_name_ar"] = full_name
    if gender:
        meta["gender"] = gender
    if birth_date:
        meta["birth_date"] = birth_date
    if phone:
        meta["phone"] = phone
    if national_id:
        meta["national_id"] = national_id
    return meta


def import_users(
    *,
    users_path: Path,
    results_path: Path,
    org_id: int,
    role_id: int,
    dry_run: bool,
    output_csv: Path,
) -> None:
    users = load_users_csv(users_path)
    memberships = load_results_csv(results_path)
    overlap_ids = sorted(set(users) & set(memberships))

    print(f"Users.csv rows:     {len(users)}")
    print(f"Results.csv users:  {len(memberships)}")
    print(f"Overlap to import:  {len(overlap_ids)}")
    print(f"Target org_id:      {org_id}")
    print(f"Target role_id:     {role_id}")
    print(f"Mode:               {'DRY-RUN' if dry_run else 'APPLY'}")
    print()

    if not overlap_ids:
        print("Nothing to import (no overlapping IDs).")
        return

    engine = create_engine(get_database_url())
    Session = sessionmaker(bind=engine)
    session = Session()

    org = session.execute(
        text("SELECT id, slug, name FROM organization WHERE id = :id"),
        {"id": org_id},
    ).mappings().first()
    if not org:
        raise SystemExit(f"Organization id={org_id} not found")

    role = session.execute(
        text("SELECT id, name FROM role WHERE id = :id"),
        {"id": role_id},
    ).mappings().first()
    if not role:
        raise SystemExit(f"Role id={role_id} not found")

    print(f"Org:  {org['name']} ({org['slug']})")
    print(f"Role: {role['name']}")
    print()

    planned: list[dict] = []
    skipped: list[dict] = []

    for legacy_id in overlap_ids:
        row = users[legacy_id]
        email = cell(row, COL_EMAIL).lower()
        if not email or "@" not in email:
            skipped.append({"legacy_user_id": legacy_id, "reason": "missing_email"})
            continue

        full_name = cell(row, COL_FULL_NAME)
        first_name, last_name = split_arabic_name(full_name)
        gender = map_gender(cell(row, COL_GENDER))
        birth_date = normalize_birth_date(cell(row, COL_BIRTH_DATE))
        phone, national_id = split_phone_or_national_id(cell(row, COL_PHONE_OR_NID))
        legacy_org_ids = memberships[legacy_id]
        username = username_from_email(email, legacy_id)

        existing = session.execute(
            text(
                """
                SELECT id, username, email FROM "user"
                WHERE email = :email OR username = :username
                LIMIT 1
                """
            ),
            {"email": email, "username": username},
        ).mappings().first()
        if existing:
            skipped.append(
                {
                    "legacy_user_id": legacy_id,
                    "email": email,
                    "reason": "already_exists",
                    "existing_user_id": existing["id"],
                }
            )
            continue

        # Ensure username uniqueness if local-part collides with another import row
        base_username = username
        suffix = 1
        while any(p["username"] == username for p in planned) or session.execute(
            text('SELECT 1 FROM "user" WHERE username = :u LIMIT 1'),
            {"u": username},
        ).first():
            suffix += 1
            username = f"{base_username}{suffix}"

        temporary_password = generate_temporary_password()
        planned.append(
            {
                "legacy_user_id": legacy_id,
                "legacy_org_ids": legacy_org_ids,
                "email": email,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "full_name_ar": full_name,
                "gender": gender,
                "birth_date": birth_date,
                "phone": phone,
                "national_id": national_id,
                "temporary_password": temporary_password,
            }
        )

    print(f"Will create: {len(planned)}")
    print(f"Skipped:     {len(skipped)}")
    for item in skipped[:20]:
        print(f"  skip {item.get('legacy_user_id')} — {item.get('reason')} {item.get('email', '')}")
    if len(skipped) > 20:
        print(f"  ... and {len(skipped) - 20} more")
    print()

    if dry_run:
        print("Dry-run only. Re-run with --apply to write to the database.")
        for item in planned:
            print(
                f"  + {item['email']} / {item['username']} "
                f"(legacy={item['legacy_user_id']})"
            )
        return

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    created_rows: list[dict] = []

    try:
        for item in planned:
            now_iso = str(datetime.now())
            user_uuid = f"user_{uuid4()}"
            meta = build_extra_metadata(
                legacy_user_id=item["legacy_user_id"],
                legacy_org_ids=item["legacy_org_ids"],
                full_name=item["full_name_ar"],
                gender=item["gender"],
                birth_date=item["birth_date"],
                phone=item["phone"],
                national_id=item["national_id"],
            )
            password_hash = security_hash_password(item["temporary_password"])
            verified_at = datetime.now(timezone.utc).isoformat()

            result = session.execute(
                text(
                    """
                    INSERT INTO "user" (
                        username, first_name, last_name, email, password,
                        user_uuid, email_verified, email_verified_at,
                        signup_method, must_change_password, extra_metadata,
                        creation_date, update_date,
                        avatar_image, bio, details, profile,
                        is_superadmin, failed_login_attempts
                    ) VALUES (
                        :username, :first_name, :last_name, :email, :password,
                        :user_uuid, TRUE, :email_verified_at,
                        'admin_created', TRUE, CAST(:extra_metadata AS jsonb),
                        :creation_date, :update_date,
                        '', '', '{}'::json, '{}'::json,
                        FALSE, 0
                    )
                    RETURNING id
                    """
                ),
                {
                    "username": item["username"],
                    "first_name": item["first_name"] or "",
                    "last_name": item["last_name"] or "",
                    "email": item["email"],
                    "password": password_hash,
                    "user_uuid": user_uuid,
                    "email_verified_at": verified_at,
                    "extra_metadata": json.dumps(meta, ensure_ascii=False),
                    "creation_date": now_iso,
                    "update_date": now_iso,
                },
            )
            user_id = result.scalar_one()

            session.execute(
                text(
                    """
                    INSERT INTO userorganization (
                        user_id, org_id, role_id, creation_date, update_date
                    ) VALUES (
                        :user_id, :org_id, :role_id, :creation_date, :update_date
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "org_id": org_id,
                    "role_id": role_id,
                    "creation_date": now_iso,
                    "update_date": now_iso,
                },
            )

            created_rows.append(
                {
                    "user_id": user_id,
                    "user_uuid": user_uuid,
                    "username": item["username"],
                    "email": item["email"],
                    "temporary_password": item["temporary_password"],
                    "legacy_user_id": item["legacy_user_id"],
                    "legacy_org_ids": "|".join(item["legacy_org_ids"]),
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                }
            )
            print(f"  created {item['email']} (id={user_id})")

        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "user_id",
                "user_uuid",
                "username",
                "email",
                "temporary_password",
                "legacy_user_id",
                "legacy_org_ids",
                "first_name",
                "last_name",
            ],
        )
        writer.writeheader()
        writer.writerows(created_rows)

    print()
    print(f"Created {len(created_rows)} users.")
    print(f"Temporary passwords saved to: {output_csv}")
    print("Users must change password on first login.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--users-csv",
        type=Path,
        default=default_desktop("Users.csv"),
        help="Path to Users.csv (profile export without header)",
    )
    parser.add_argument(
        "--results-csv",
        type=Path,
        default=default_desktop("Results.csv"),
        help="Path to Results.csv (user_id, org_id)",
    )
    parser.add_argument("--org-id", type=int, default=DEFAULT_ORG_ID)
    parser.add_argument("--role-id", type=int, default=DEFAULT_MEMBER_ROLE_ID)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be imported without writing",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write users to the database",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=API_ROOT / "scripts" / "output" / "legacy_import_passwords.csv",
        help="CSV path for generated temporary passwords",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        args.dry_run = True
        print("No --apply given; defaulting to --dry-run.\n")

    if args.apply and args.dry_run:
        raise SystemExit("Use either --dry-run or --apply, not both.")

    if not args.users_csv.exists():
        raise SystemExit(f"Users.csv not found: {args.users_csv}")
    if not args.results_csv.exists():
        raise SystemExit(f"Results.csv not found: {args.results_csv}")

    import_users(
        users_path=args.users_csv,
        results_path=args.results_csv,
        org_id=args.org_id,
        role_id=args.role_id,
        dry_run=not args.apply,
        output_csv=args.output,
    )


if __name__ == "__main__":
    main()
