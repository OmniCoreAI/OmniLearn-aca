from fastapi import UploadFile

from src.services.utils.upload_content import upload_file


async def upload_program_image(
    image_file: UploadFile, org_uuid: str, program_uuid: str, kind: str
) -> str:
    """Upload a program thumbnail or banner image, reusing the org uploader.

    ``kind`` is either ``"thumbnail"`` or ``"banner"`` and only decides the
    on-disk subdirectory + filename prefix; validation matches course images.
    """
    subdir = "thumbnails" if kind == "thumbnail" else "banners"
    return await upload_file(
        file=image_file,
        directory=f"programs/{program_uuid}/{subdir}",
        type_of_dir="orgs",
        uuid=org_uuid,
        allowed_types=["image"],
        filename_prefix=kind,
    )
