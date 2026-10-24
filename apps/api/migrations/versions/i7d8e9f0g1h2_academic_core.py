"""Academic core: calendar, course catalog, curricula, offerings, student records

Adds org-wide academic years/terms, a reusable course catalog with
prerequisites, versioned program curricula, course offerings (with sessions),
cohort memberships (student records) and enrollments. Extends ``program`` and
``cohort``.

Data step (best effort, idempotent): converts the legacy
Cohort -> Semester -> SemesterCourse structure into catalog courses, terms,
offerings (the linked LMS course becomes the offering's content course),
memberships (from the cohort user group) and enrollments. The legacy tables
are kept untouched.

Revision ID: i7d8e9f0g1h2
Revises: h6c7d8e9f0g1
Create Date: 2026-09-25

"""
from datetime import datetime
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


revision: str = 'i7d8e9f0g1h2'
down_revision: Union[str, None] = 'h6c7d8e9f0g1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = [
    'academicyear',
    'academicterm',
    'academiccourse',
    'courseprerequisite',
    'curriculum',
    'curriculumitem',
    'courseoffering',
    'offeringsession',
    'cohortmembership',
    'enrollment',
]


def _columns(inspector, table):
    return {c['name'] for c in inspector.get_columns(table)}


def upgrade() -> None:
    from sqlmodel import SQLModel
    # Import the models so their Table objects (and enums) are registered.
    from src.db.academic import calendar, catalog, curricula, offerings  # noqa: F401

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # 1. program extensions
    program_cols = _columns(inspector, 'program')
    for name, type_ in (
        ('faculty', sa.String()),
        ('department', sa.String()),
        ('min_credits', sa.Float()),
        ('duration_months', sa.Integer()),
        ('max_duration_months', sa.Integer()),
    ):
        if name not in program_cols:
            op.add_column('program', sa.Column(name, type_, nullable=True))

    # 2. new tables (created from the model metadata; checkfirst keeps this
    #    safe when startup create_all already created them)
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    # 3. cohort extensions
    cohort_cols = _columns(inspector, 'cohort')
    if 'code' not in cohort_cols:
        op.add_column('cohort', sa.Column('code', sa.String(), nullable=True))
    if 'curriculum_id' not in cohort_cols:
        op.add_column('cohort', sa.Column('curriculum_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_cohort_curriculum_id', 'cohort', 'curriculum', ['curriculum_id'], ['id'], ondelete='SET NULL'
        )
    if 'intake_term_id' not in cohort_cols:
        op.add_column('cohort', sa.Column('intake_term_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_cohort_intake_term_id', 'cohort', 'academicterm', ['intake_term_id'], ['id'], ondelete='SET NULL'
        )
    cohort_indexes = {ix['name'] for ix in inspector.get_indexes('cohort')}
    if 'uq_cohort_org_code' not in cohort_indexes:
        op.create_index(
            'uq_cohort_org_code', 'cohort', ['org_id', 'code'], unique=True,
            postgresql_where=sa.text('code IS NOT NULL'),
        )

    _migrate_legacy_structure(bind)


def _now() -> str:
    return str(datetime.now())


def _migrate_legacy_structure(bind) -> None:
    """Semester/SemesterCourse -> Term/CatalogCourse/Offering (+ students)."""
    q = lambda sql, **kw: bind.execute(sa.text(sql), kw)  # noqa: E731

    links = q(
        """
        SELECT sc.id AS link_id, sc.code AS link_code, sc.credit_hours AS link_credits,
               sc.course_id, c.name AS course_name, c.description AS course_description,
               s.id AS semester_id, s.name AS semester_name, s.start_date AS s_start,
               s.end_date AS s_end, s."order" AS s_order,
               co.id AS cohort_id, co.academic_year AS cohort_year, co.org_id,
               p.code AS program_code
        FROM semestercourse sc
        JOIN course c ON c.id = sc.course_id
        JOIN semester s ON s.id = sc.semester_id
        JOIN cohort co ON co.id = s.cohort_id
        JOIN program p ON p.id = co.program_id
        """
    ).mappings().all()

    # Cohort codes for existing cohorts (program code + first year digits).
    cohorts = q(
        "SELECT co.id, co.org_id, co.academic_year, co.start_date, co.code, p.code AS program_code "
        "FROM cohort co JOIN program p ON p.id = co.program_id"
    ).mappings().all()
    used_codes = {(r['org_id'], r['code']) for r in cohorts if r['code']}
    for row in cohorts:
        if row['code'] or not row['program_code']:
            continue
        year = None
        for source in (row['academic_year'], row['start_date']):
            if source and str(source)[:4].isdigit():
                year = str(source)[:4]
                break
        if not year:
            continue
        base = f"{row['program_code'].upper()}-{year}"
        candidate, n = base, 1
        while (row['org_id'], candidate) in used_codes:
            n += 1
            candidate = f"{base}-{n}"
        used_codes.add((row['org_id'], candidate))
        q("UPDATE cohort SET code = :code WHERE id = :id", code=candidate, id=row['id'])

    year_ids: dict = {}
    term_ids: dict = {}
    course_ids: dict = {}

    def academic_year_id(org_id, cohort_year, start):
        code = None
        if cohort_year and len(str(cohort_year)) == 9 and '/' in str(cohort_year):
            code = str(cohort_year)
        else:
            base = None
            for source in (cohort_year, start):
                if source and str(source)[:4].isdigit():
                    base = int(str(source)[:4])
                    break
            base = base or datetime.now().year
            code = f"{base}/{base + 1}"
        key = (org_id, code)
        if key in year_ids:
            return year_ids[key]
        found = q("SELECT id FROM academicyear WHERE org_id = :o AND code = :c", o=org_id, c=code).scalar()
        if not found:
            found = q(
                "INSERT INTO academicyear (code, name, status, org_id, academic_year_uuid, creation_date, update_date) "
                "VALUES (:c, :n, 'ACTIVE', :o, :u, :d, :d) RETURNING id",
                c=code, n=f"Academic Year {code}", o=org_id, u=f"academicyear_{uuid4()}", d=_now(),
            ).scalar()
        year_ids[key] = found
        return found

    for link in links:
        org_id = link['org_id']

        # Term per legacy semester.
        term_key = link['semester_id']
        if term_key not in term_ids:
            code = f"LEGACY-S{link['semester_id']}"
            found = q("SELECT id FROM academicterm WHERE org_id = :o AND code = :c", o=org_id, c=code).scalar()
            if not found:
                found = q(
                    'INSERT INTO academicterm (name, term_type, "order", start_date, end_date, status, code, org_id, '
                    'academic_year_id, term_uuid, creation_date, update_date) VALUES '
                    "(:n, 'CUSTOM', :ord, :s, :e, 'IN_PROGRESS', :c, :o, :y, :u, :d, :d) RETURNING id",
                    n=link['semester_name'], ord=link['s_order'] or 0, s=link['s_start'], e=link['s_end'], c=code,
                    o=org_id, y=academic_year_id(org_id, link['cohort_year'], link['s_start']),
                    u=f"term_{uuid4()}", d=_now(),
                ).scalar()
            term_ids[term_key] = found

        # Catalog course per legacy LMS course.
        if link['course_id'] not in course_ids:
            raw = (link['link_code'] or '').strip().upper().replace(' ', '-').replace('_', '-')
            code = raw[:20] if raw else f"LEGACY-{link['course_id']}"
            if q("SELECT 1 FROM academiccourse WHERE org_id = :o AND code = :c", o=org_id, c=code).scalar():
                code = f"{code[:14]}-{link['course_id']}"
            profile_credits = q(
                "SELECT credit_hours FROM courseacademicprofile WHERE course_id = :c", c=link['course_id']
            ).scalar()
            found = q(
                "INSERT INTO academiccourse (code, name, description, credits, course_type, status, org_id, "
                "academic_course_uuid, creation_date, update_date) VALUES "
                "(:code, :name, :descr, :cr, 'CORE', 'ACTIVE', :o, :u, :d, :d) RETURNING id",
                code=code, name=link['course_name'], descr=link['course_description'],
                cr=link['link_credits'] or profile_credits or 0, o=org_id, u=f"acourse_{uuid4()}", d=_now(),
            ).scalar()
            course_ids[link['course_id']] = (found, code)
        academic_course_id, course_code = course_ids[link['course_id']]

        # Offering (legacy LMS course becomes its content course).
        exists = q(
            "SELECT id FROM courseoffering WHERE academic_course_id = :a AND term_id = :t AND cohort_id = :c AND section = 'A'",
            a=academic_course_id, t=term_ids[term_key], c=link['cohort_id'],
        ).scalar()
        if exists:
            continue
        profile = q(
            "SELECT id, instructor_id, classroom, capacity FROM courseacademicprofile WHERE course_id = :c",
            c=link['course_id'],
        ).mappings().first()
        offering_id = q(
            "INSERT INTO courseoffering (section, classroom, capacity, status, code, org_id, academic_course_id, "
            "term_id, cohort_id, instructor_id, content_course_id, offering_uuid, creation_date, update_date, "
            "extra_metadata) VALUES ('A', :room, :cap, 'IN_PROGRESS', :code, :o, :a, :t, :c, :i, :cc, :u, :d, :d, "
            "CAST(:meta AS JSONB)) RETURNING id",
            room=profile['classroom'] if profile else None, cap=profile['capacity'] if profile else None,
            code=f"{course_code}-LEGACY-S{link['semester_id']}-A", o=org_id, a=academic_course_id,
            t=term_ids[term_key], c=link['cohort_id'], i=profile['instructor_id'] if profile else None,
            cc=link['course_id'], u=f"offering_{uuid4()}", d=_now(),
            meta='{"migrated_from_semestercourse": %d}' % link['link_id'],
        ).scalar()
        if profile:
            q(
                "INSERT INTO offeringsession (title, start_datetime, end_datetime, location, \"order\", offering_id, "
                "org_id, session_uuid, creation_date, update_date) "
                "SELECT title, start_date, end_date, location, \"order\", :off, org_id, "
                "'offeringsession_' || md5(random()::text || id::text), :d, :d "
                "FROM courseschedulesession WHERE profile_id = :p",
                off=offering_id, p=profile['id'], d=_now(),
            )

    # Student records from the cohort enrollment groups.
    members = q(
        "SELECT co.id AS cohort_id, co.org_id, co.code, ugu.user_id, ugu.creation_date "
        "FROM cohort co JOIN usergroupuser ugu ON ugu.usergroup_id = co.usergroup_id "
        "ORDER BY co.id, ugu.id"
    ).mappings().all()
    seq: dict = {}
    for m in members:
        if q(
            "SELECT 1 FROM cohortmembership WHERE cohort_id = :c AND user_id = :u", c=m['cohort_id'], u=m['user_id']
        ).scalar():
            continue
        seq[m['cohort_id']] = seq.get(m['cohort_id'], 0) + 1
        number = f"{m['code'] or 'C%d' % m['cohort_id']}-{seq[m['cohort_id']]:03d}"
        membership_id = q(
            "INSERT INTO cohortmembership (cohort_id, user_id, org_id, student_number, status, admitted_at, "
            "status_changed_at, membership_uuid) VALUES (:c, :u, :o, :n, 'ACTIVE', :a, :d, :uu) RETURNING id",
            c=m['cohort_id'], u=m['user_id'], o=m['org_id'], n=number, a=m['creation_date'] or _now(),
            d=_now(), uu=f"cmember_{uuid4()}",
        ).scalar()
        q(
            "INSERT INTO enrollment (offering_id, user_id, membership_id, org_id, status, registered_at, "
            "status_changed_at, enrollment_uuid) "
            "SELECT id, :u, :m, org_id, 'REGISTERED', :d, :d, 'enrollment_' || md5(random()::text || id::text) "
            "FROM courseoffering WHERE cohort_id = :c "
            "AND NOT EXISTS (SELECT 1 FROM enrollment e WHERE e.offering_id = courseoffering.id AND e.user_id = :u)",
            u=m['user_id'], m=membership_id, c=m['cohort_id'], d=_now(),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cohort_cols = _columns(inspector, 'cohort')
    if 'uq_cohort_org_code' in {ix['name'] for ix in inspector.get_indexes('cohort')}:
        op.drop_index('uq_cohort_org_code', table_name='cohort')
    if 'intake_term_id' in cohort_cols:
        op.drop_constraint('fk_cohort_intake_term_id', 'cohort', type_='foreignkey')
        op.drop_column('cohort', 'intake_term_id')
    if 'curriculum_id' in cohort_cols:
        op.drop_constraint('fk_cohort_curriculum_id', 'cohort', type_='foreignkey')
        op.drop_column('cohort', 'curriculum_id')
    if 'code' in cohort_cols:
        op.drop_column('cohort', 'code')

    existing = set(inspector.get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
    for enum_name in (
        'enrollment_status', 'cohort_membership_status', 'offering_status', 'curriculum_requirement',
        'curriculum_status', 'academic_course_status', 'academic_course_type', 'academic_term_status',
        'academic_term_type', 'academic_year_status',
    ):
        op.execute(f'DROP TYPE IF EXISTS {enum_name}')

    program_cols = _columns(inspector, 'program')
    for name in ('faculty', 'department', 'min_credits', 'duration_months', 'max_duration_months'):
        if name in program_cols:
            op.drop_column('program', name)
