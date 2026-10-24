"""Templated notification emails close in their own language (academy email frame)."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.services.notifications.render import wrap_email


@pytest.mark.parametrize("language,line", [
    ("ar", "الأكاديمية الوطنية لمكافحة الفساد · هيئة الرقابة الإدارية"),
    ("en", "Anti-Corruption Academy · Administrative Control Authority"),
    ("fr", "Académie de lutte contre la corruption · Autorité de contrôle administratif"),
])
def test_wrap_email_closes_in_the_template_language(language, line):
    config = SimpleNamespace(mailing_config=SimpleNamespace(email_logo_url=None))
    with patch("src.services.users.emails.get_omnilearn_config", return_value=config):
        html = wrap_email("<p>body</p>", language)
    assert line in html
