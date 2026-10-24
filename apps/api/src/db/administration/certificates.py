"""Certificate templates (Administration → Certificates).

A template is a layout preset plus a ``design`` JSON (colors, font, logos,
texts with ``{{variables}}``, signatures, QR code). Courses pick one through
``Certifications.config["certificate_template_uuid"]``, training programs
through ``trainingprogram.certificate_template_id``; otherwise the org default
applies, and certificates without any template keep the legacy patterns.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field as PydanticField, field_validator
from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.administration.lookups import ConfigStatus, status_column

FONTS = ("Cairo", "Tajawal", "Amiri", "Inter", "Playfair Display", "Georgia")
LAYOUTS = ("classic", "modern", "minimal", "bordered")
HEX_RE = r"^#[0-9a-fA-F]{6}$"


class SignatureDesign(BaseModel):
    name: str = PydanticField(default="", max_length=120)
    title: str = PydanticField(default="", max_length=120)
    # Uploaded file name (org content: certificates/templates/<uuid>/).
    image: Optional[str] = None


class CertificateDesign(BaseModel):
    primary_color: str = PydanticField(default="#1F3A5F", pattern=HEX_RE)
    accent_color: str = PydanticField(default="#C9A227", pattern=HEX_RE)
    text_color: str = PydanticField(default="#1F2937", pattern=HEX_RE)
    background_color: str = PydanticField(default="#FFFFFF", pattern=HEX_RE)
    background_image: Optional[str] = None
    border_style: Literal["none", "single", "double", "ornate"] = "double"
    font_family: str = "Cairo"
    direction: Literal["ltr", "rtl"] = "ltr"
    show_org_logo: bool = True
    secondary_logo: Optional[str] = None
    title_text: str = PydanticField(default="Certificate of Completion", max_length=200)
    subtitle_text: str = PydanticField(default="This is to certify that", max_length=300)
    body_text: str = PydanticField(
        default="has successfully completed {{course_name}} on {{completion_date}}.", max_length=1000
    )
    footer_text: str = PydanticField(default="", max_length=500)
    show_qr: bool = True
    show_certificate_id: bool = True
    signatures: List[SignatureDesign] = PydanticField(default_factory=list, max_length=3)

    @field_validator("font_family")
    @classmethod
    def _font(cls, value: str) -> str:
        return value if value in FONTS else "Cairo"


class CertificateTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    name: str
    layout: str = "classic"
    orientation: str = "landscape"
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    is_default: bool = False
    design: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # e.g. "EACA-{YYYY}-{SEQ:5}" — tokens {YYYY} {YY} {MM} {SEQ:n}
    serial_format: str = "{YYYY}-{SEQ:5}"
    template_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class CertificateTemplateCreate(SQLModel):
    name: str
    layout: str = "classic"
    orientation: Literal["landscape", "portrait"] = "landscape"
    status: ConfigStatus = ConfigStatus.ACTIVE
    is_default: bool = False
    design: Optional[dict] = None
    serial_format: str = "{YYYY}-{SEQ:5}"


class CertificateTemplateUpdate(SQLModel):
    name: Optional[str] = None
    layout: Optional[str] = None
    orientation: Optional[Literal["landscape", "portrait"]] = None
    status: Optional[ConfigStatus] = None
    is_default: Optional[bool] = None
    design: Optional[dict] = None
    serial_format: Optional[str] = None


class CertificateTemplateRead(SQLModel):
    id: int
    template_uuid: str
    name: str
    layout: str
    orientation: str
    status: ConfigStatus
    is_default: bool
    design: dict
    serial_format: str
    usage_count: int = 0
    creation_date: str
    update_date: str


class CertificateTemplateOption(SQLModel):
    template_uuid: str
    name: str
    is_default: bool = False


class CertificateRenderRead(SQLModel):
    """Everything a page needs to draw a template certificate."""

    template: CertificateTemplateRead
    variables: dict
    org_uuid: str
