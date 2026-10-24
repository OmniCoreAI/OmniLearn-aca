"""
Phone numbers for sign-in and SMS: one canonical form (E.164, e.g.
"+201001234567") so a number typed "0100 123 4567" on a form, stored, and
looked up again is always the same string.
"""

from typing import Optional

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberType

# Codes are sent by SMS, so only numbers that can receive one are accepted.
_SMS_CAPABLE = {PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE}


def normalize_phone(raw: Optional[str], region: Optional[str] = "EG") -> Optional[str]:
    """
    `raw` as an E.164 mobile number, or None when it isn't a valid one.
    `region` (ISO 3166-1 alpha-2) is the country assumed for numbers typed
    without a "+country code"; Egypt by default.
    """
    if not raw or not raw.strip():
        return None
    try:
        number = phonenumbers.parse(raw, region.upper() if region else None)
    except NumberParseException:
        return None
    if not phonenumbers.is_valid_number(number):
        return None
    if phonenumbers.number_type(number) not in _SMS_CAPABLE:
        return None
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
