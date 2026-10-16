from src.services.utils.http_headers import content_disposition


def test_non_latin_names_are_header_safe():
    for name in ("كشف الدرجات.pdf", "5b2233d3-…608a72&direct=1.pdf", 'a "quoted" name.pdf', "line\nbreak.pdf"):
        value = content_disposition(name)
        value.encode("latin-1")  # would raise for an unsafe header
        assert "\n" not in value


def test_ascii_fallback_and_utf8_name():
    assert content_disposition("كشف.pdf") == (
        "inline; filename=\"document.pdf\"; filename*=UTF-8''%D9%83%D8%B4%D9%81.pdf"
    )
    assert content_disposition("report.pdf", "attachment") == (
        "attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf"
    )
