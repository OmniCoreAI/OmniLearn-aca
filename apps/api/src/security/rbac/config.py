"""
RBAC Resource Configurations

This module defines configurations for each resource type that the RBAC system handles.
Adding a new resource type is as simple as adding a new entry to RESOURCE_CONFIGS.
"""

from src.security.rbac.types import ResourceConfig


RESOURCE_CONFIGS: dict[str, ResourceConfig] = {
    # ============================================
    # PRIMARY RESOURCES (have their own access rules)
    # ============================================
    "courses": ResourceConfig(
        resource_type="courses",
        uuid_prefix="course_",
        has_published_field=True,
        supports_usergroups=True,
        supports_authorship=True,
        model_name="Course",
        uuid_field="course_uuid",
    ),
    "folders": ResourceConfig(
        resource_type="folders",
        uuid_prefix="folder_",
        has_published_field=False,  # Folders use only the public flag
        supports_usergroups=True,
        supports_authorship=True,
        model_name="Folder",
        uuid_field="folder_uuid",
    ),
    "media": ResourceConfig(
        resource_type="media",
        uuid_prefix="media_",
        has_published_field=False,  # Media uses only the public flag
        supports_usergroups=True,
        supports_authorship=True,
        model_name="Media",
        uuid_field="media_uuid",
    ),

    "boards": ResourceConfig(
        resource_type="boards",
        uuid_prefix="board_",
        has_published_field=False,
        supports_usergroups=True,
        supports_authorship=True,
        model_name="Board",
        uuid_field="board_uuid",
    ),

    # Academic Management: Postgraduate Studies (top-level Program) and
    # Training Programs. Both behave like courses for access purposes.
    "programs": ResourceConfig(
        resource_type="programs",
        uuid_prefix="program_",
        has_published_field=True,
        supports_usergroups=True,
        supports_authorship=True,
        model_name="Program",
        uuid_field="program_uuid",
    ),
    "training_programs": ResourceConfig(
        resource_type="training_programs",
        uuid_prefix="trainingprogram_",
        has_published_field=True,
        supports_usergroups=True,
        supports_authorship=True,
        model_name="TrainingProgram",
        uuid_field="trainingprogram_uuid",
    ),

    # ============================================
    # CHILD RESOURCES (inherit access from parent)
    # ============================================
    "coursechapters": ResourceConfig(
        resource_type="coursechapters",
        uuid_prefix="chapter_",
        has_published_field=False,  # Inherits from course
        supports_usergroups=False,  # Access via course
        supports_authorship=False,  # Authorship on course level
        model_name="Chapter",
        uuid_field="chapter_uuid",
        parent_resource_type="courses",
        parent_id_field="course_id",
    ),
    "activities": ResourceConfig(
        resource_type="activities",
        uuid_prefix="activity_",
        has_published_field=False,  # Inherits from course via chapter
        supports_usergroups=False,  # Access via course
        supports_authorship=False,  # Authorship on course level
        model_name="Activity",
        uuid_field="activity_uuid",
        parent_resource_type="coursechapters",  # Activity -> Chapter -> Course
        parent_id_field="chapter_id",
    ),
    # Postgraduate hierarchy: Cohort -> Semester both delegate their access
    # decision up to the owning Program (like chapters -> courses). Courses are
    # linked directly to a Semester and keep their own (course_) RBAC.
    "cohorts": ResourceConfig(
        resource_type="cohorts",
        uuid_prefix="cohort_",
        has_published_field=False,  # Inherits from program
        supports_usergroups=False,  # Access via program
        supports_authorship=False,  # Authorship on program level
        model_name="Cohort",
        uuid_field="cohort_uuid",
        parent_resource_type="programs",
        parent_id_field="program_id",
    ),
    "semesters": ResourceConfig(
        resource_type="semesters",
        uuid_prefix="semester_",
        has_published_field=False,
        supports_usergroups=False,
        supports_authorship=False,
        model_name="Semester",
        uuid_field="semester_uuid",
        parent_resource_type="cohorts",  # Semester -> Cohort -> Program
        parent_id_field="cohort_id",
    ),
}


def get_resource_config(resource_uuid: str) -> ResourceConfig | None:
    """
    Get the resource configuration based on the UUID prefix.

    Args:
        resource_uuid: The UUID of the resource

    Returns:
        ResourceConfig if found, None otherwise
    """
    # Handle None/empty input to avoid AttributeError
    if not resource_uuid:
        return None

    for config in RESOURCE_CONFIGS.values():
        if resource_uuid.startswith(config.uuid_prefix):
            return config
    return None


def get_resource_type(resource_uuid: str) -> str | None:
    """
    Get the resource type from a UUID.

    Args:
        resource_uuid: The UUID of the resource

    Returns:
        Resource type string if found, None otherwise
    """
    config = get_resource_config(resource_uuid)
    return config.resource_type if config else None
