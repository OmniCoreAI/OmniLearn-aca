from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class CMSNews(SQLModel, table=True):
    __tablename__ = "cms_news"
    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="uq_cms_news_org_slug"),
        Index("ix_cms_news_org_published_at", "org_id", "published", "published_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    news_uuid: str = Field(default="", index=True)
    title: str
    slug: str = Field(default="", index=True)
    excerpt: str = ""
    body: str = Field(default="", sa_column=Column(Text, nullable=False))
    cover_image: str = ""
    images: list = Field(default_factory=list, sa_column=Column(JSONB, nullable=False))
    videos: list = Field(default_factory=list, sa_column=Column(JSONB, nullable=False))
    published: bool = False
    published_at: Optional[str] = None
    created_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""


class CMSNewsCreate(SQLModel):
    title: str
    slug: Optional[str] = None
    excerpt: str = ""
    body: str = ""
    cover_image: str = ""
    published: bool = False
    published_at: Optional[str] = None


class CMSNewsUpdate(SQLModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    cover_image: Optional[str] = None
    published: Optional[bool] = None
    published_at: Optional[str] = None


class CMSNewsImageOut(SQLModel):
    id: int
    imageName: str
    imageURL: str
    dateCreatedString: str


class CMSNewsVideoOut(SQLModel):
    id: int
    videoName: str
    videoURL: str
    dateCreatedString: str


class CMSNewsRead(SQLModel):
    id: int
    org_id: int
    org_uuid: str = ""
    news_uuid: str
    title: str
    slug: str
    excerpt: str = ""
    body: str = ""
    cover_image: str = ""
    images: list[CMSNewsImageOut] = []
    videos: list[CMSNewsVideoOut] = []
    published: bool = False
    published_at: Optional[str] = None
    created_by: Optional[int] = None
    creation_date: str = ""
    update_date: str = ""


class CMSNewsListItem(SQLModel):
    """List row without full rich body."""

    id: int
    org_id: int
    org_uuid: str = ""
    news_uuid: str
    title: str
    slug: str
    excerpt: str = ""
    cover_image: str = ""
    images: list[CMSNewsImageOut] = []
    videos: list[CMSNewsVideoOut] = []
    published: bool = False
    published_at: Optional[str] = None
    creation_date: str = ""
    update_date: str = ""


class CMSNewsListResponse(SQLModel):
    items: list[CMSNewsListItem]
    total: int
    page: int
    limit: int
