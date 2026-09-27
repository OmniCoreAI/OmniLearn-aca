"""Org-level administration settings with typed, registered schemas.

Every key is backed by a pydantic model registered in ``SETTING_SCHEMAS``; a
stored value is always merged over the model defaults on read and fully
validated on write, so consumers can rely on the shape.
"""
from typing import Dict, List, Optional, Type

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.settings import AdminSetting
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import bad_request, get_org_or_404, now


class TaxRate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    rate: float = Field(ge=0, le=100)
    is_default: bool = False


class FinanceDefaults(BaseModel):
    """Currencies and taxes offered by every price/rate/cost form."""

    default_currency: str = "EGP"
    currencies: List[str] = ["EGP", "USD"]
    tax_rates: List[TaxRate] = [TaxRate(name="VAT", rate=14.0, is_default=True)]

    @field_validator("currencies")
    @classmethod
    def _currencies(cls, value: List[str]) -> List[str]:
        cleaned = []
        for code in value:
            code = (code or "").strip().upper()
            if len(code) != 3 or not code.isalpha():
                raise ValueError(f"Invalid currency code: {code!r} (use ISO codes like EGP)")
            if code not in cleaned:
                cleaned.append(code)
        if not cleaned:
            raise ValueError("At least one currency is required")
        return cleaned

    @field_validator("default_currency")
    @classmethod
    def _default_currency(cls, value: str) -> str:
        return (value or "").strip().upper()

    def model_post_init(self, __context) -> None:
        if self.default_currency not in self.currencies:
            self.currencies = [self.default_currency, *self.currencies]


# key -> schema.
SETTING_SCHEMAS: Dict[str, Type[BaseModel]] = {
    "finance_defaults": FinanceDefaults,
}
# Keys members (not only managers) may read — used by pickers/forms.
MEMBER_READABLE_KEYS = {"finance_defaults"}


def register_setting(key: str, schema: Type[BaseModel], member_readable: bool = False) -> None:
    SETTING_SCHEMAS[key] = schema
    if member_readable:
        MEMBER_READABLE_KEYS.add(key)


def _schema(key: str) -> Type[BaseModel]:
    schema = SETTING_SCHEMAS.get(key)
    if not schema:
        raise bad_request(f"Unknown setting: {key}")
    return schema


async def _row(db_session: AsyncSession, org_id: int, key: str) -> Optional[AdminSetting]:
    return (
        await db_session.execute(
            select(AdminSetting).where(AdminSetting.org_id == org_id, AdminSetting.key == key)
        )
    ).scalars().first()


async def load_setting(db_session: AsyncSession, org_id: int, key: str) -> BaseModel:
    """Internal (no authz): the validated setting, defaults filled in."""
    schema = _schema(key)
    row = await _row(db_session, org_id, key)
    try:
        return schema(**(row.value or {})) if row else schema()
    except ValidationError:
        # A stored value that no longer validates must not break consumers.
        return schema()


async def get_setting(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, key: str
) -> dict:
    _schema(key)
    if key in MEMBER_READABLE_KEYS:
        await require_org_member(db_session, current_user, org_id)
    else:
        await authorize_admin(db_session, current_user, org_id, "configuration", "read")
    return (await load_setting(db_session, org_id, key)).model_dump()


async def put_setting(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, key: str, value: dict
) -> dict:
    schema = _schema(key)
    bucket = "communications" if key.startswith("notifications") else "configuration"
    user_id = await authorize_admin(db_session, current_user, org_id, bucket, "update")
    await get_org_or_404(db_session, org_id)
    try:
        validated = schema(**(value or {}))
    except ValidationError as exc:
        raise bad_request("; ".join(e["msg"] for e in exc.errors()))
    row = await _row(db_session, org_id, key)
    if row:
        row.value = validated.model_dump()
        row.updated_by_user_id = user_id
        row.update_date = now()
    else:
        row = AdminSetting(
            org_id=org_id,
            key=key,
            value=validated.model_dump(),
            updated_by_user_id=user_id,
            creation_date=now(),
            update_date=now(),
        )
    db_session.add(row)
    await db_session.commit()
    return validated.model_dump()
