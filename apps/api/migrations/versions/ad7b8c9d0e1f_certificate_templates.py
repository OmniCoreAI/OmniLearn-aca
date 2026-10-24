"""Certificate templates, program template link and certificate serial numbers

Adds ``certificatetemplate``, ``trainingprogram.certificate_template_id`` and
``certificateuser.serial_no`` (a place for legacy EACA serials too).

Revision ID: ad7b8c9d0e1f
Revises: ad6a7b8c9d0e
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad7b8c9d0e1f'
down_revision: Union[str, None] = 'ad6a7b8c9d0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(bind, table: str) -> set:
    return {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import certificates  # noqa: F401  (registers the table)
    from src.security.rbac.nav_items import grant_saved_nav_items

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if 'certificatetemplate' not in existing:
        SQLModel.metadata.tables['certificatetemplate'].create(bind, checkfirst=True)
    if 'trainingprogram' in existing and 'certificate_template_id' not in _columns(bind, 'trainingprogram'):
        op.add_column(
            'trainingprogram',
            sa.Column(
                'certificate_template_id', sa.Integer(),
                sa.ForeignKey('certificatetemplate.id', ondelete='SET NULL'), nullable=True,
            ),
        )
    if 'certificateuser' in existing and 'serial_no' not in _columns(bind, 'certificateuser'):
        op.add_column('certificateuser', sa.Column('serial_no', sa.String(), nullable=True))
        op.create_index('ix_certificateuser_serial_no', 'certificateuser', ['serial_no'])

    grant_saved_nav_items(bind, 'role_global_admin', ['certificate-templates'])


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if 'certificateuser' in existing and 'serial_no' in _columns(bind, 'certificateuser'):
        op.drop_index('ix_certificateuser_serial_no', table_name='certificateuser')
        op.drop_column('certificateuser', 'serial_no')
    if 'trainingprogram' in existing and 'certificate_template_id' in _columns(bind, 'trainingprogram'):
        op.drop_column('trainingprogram', 'certificate_template_id')
    if 'certificatetemplate' in existing:
        op.drop_table('certificatetemplate')
