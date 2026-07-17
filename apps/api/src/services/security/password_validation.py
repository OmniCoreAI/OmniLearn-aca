"""
Password validation service for enforcing strong password requirements.

Requirements:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
"""
import re
import secrets
from typing import List
from pydantic import BaseModel


class PasswordValidationResult(BaseModel):
    """Result of password validation."""
    is_valid: bool
    errors: List[str]
    requirements: dict


# Special characters allowed in passwords
SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{}|;':\",./<>?"


def validate_password_complexity(password: str) -> PasswordValidationResult:
    """
    Validate password against complexity requirements.

    Requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character

    Returns:
        PasswordValidationResult with validation status and any errors
    """
    errors: List[str] = []

    requirements = {
        "min_length": False,
        "has_uppercase": False,
        "has_lowercase": False,
        "has_number": False,
        "has_special": False,
    }

    # Check minimum length (8 characters)
    if len(password) >= 8:
        requirements["min_length"] = True
    else:
        errors.append("Password must be at least 8 characters long")

    # Check for uppercase letter
    if re.search(r'[A-Z]', password):
        requirements["has_uppercase"] = True
    else:
        errors.append("Password must contain at least one uppercase letter")

    # Check for lowercase letter
    if re.search(r'[a-z]', password):
        requirements["has_lowercase"] = True
    else:
        errors.append("Password must contain at least one lowercase letter")

    # Check for number
    if re.search(r'[0-9]', password):
        requirements["has_number"] = True
    else:
        errors.append("Password must contain at least one number")

    # Check for special character
    if re.search(r'[!@#$%^&*()_+\-=\[\]{}|;\':",./<>?]', password):
        requirements["has_special"] = True
    else:
        errors.append("Password must contain at least one special character (!@#$%^&*...)")

    is_valid = all(requirements.values())

    return PasswordValidationResult(
        is_valid=is_valid,
        errors=errors,
        requirements=requirements
    )


def generate_temporary_password(length: int = 16) -> str:
    """Generate a cryptographically secure password that satisfies
    ``validate_password_complexity`` (upper, lower, digit, special, >= 8 chars).

    Used for admin-provisioned accounts where the server issues a one-time
    temporary password the user must change on first login.
    """
    length = max(length, 12)

    uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I/O to avoid ambiguity
    lowercase = "abcdefghijkmnpqrstuvwxyz"  # no l/o
    digits = "23456789"  # no 0/1
    specials = "!@#$%^&*-_=+"

    # Guarantee at least one of each required class.
    required = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(specials),
    ]

    all_chars = uppercase + lowercase + digits + specials
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required))]

    password_chars = required + remaining
    # Shuffle so the guaranteed characters are not in a predictable position.
    secrets.SystemRandom().shuffle(password_chars)

    password = "".join(password_chars)

    # Defensive: ensure the generated value actually passes validation.
    if not validate_password_complexity(password).is_valid:  # pragma: no cover
        return generate_temporary_password(length)

    return password


def get_password_requirements() -> List[dict]:
    """
    Get list of password requirements for display purposes.

    Returns:
        List of requirement descriptions
    """
    return [
        {"id": "min_length", "description": "At least 8 characters"},
        {"id": "has_uppercase", "description": "At least one uppercase letter (A-Z)"},
        {"id": "has_lowercase", "description": "At least one lowercase letter (a-z)"},
        {"id": "has_number", "description": "At least one number (0-9)"},
        {"id": "has_special", "description": "At least one special character (!@#$%^&*...)"},
    ]
