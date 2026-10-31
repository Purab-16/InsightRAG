import pytest

from app.errors import AppError
from ingestion.arxiv_client import normalize_id


@pytest.mark.parametrize(
    "raw",
    [
        "2310.06825",
        "2310.06825v3",
        "arXiv:2310.06825",
        "https://arxiv.org/abs/2310.06825",
        "https://arxiv.org/pdf/2310.06825v2.pdf",
        "arxiv.org/abs/2310.06825",
        "  2310.06825  ",
    ],
)
def test_new_style_ids(raw):
    assert normalize_id(raw) == "2310.06825"


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("hep-th/9901001", "hep-th/9901001"),
        ("hep-th/9901001v2", "hep-th/9901001"),
        ("https://arxiv.org/abs/hep-th/9901001", "hep-th/9901001"),
        ("math.GT/0309136", "math.GT/0309136"),
    ],
)
def test_old_style_ids(raw, expected):
    assert normalize_id(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "hello",
        "12345",
        "2310.0682",
        "https://evil.com/abs/2310.06825",
        "https://arxiv.org.evil.com/abs/2310.06825",
        "http://169.254.169.254/latest/meta-data",
        "https://arxiv.org/list/cs.LG/recent",
    ],
)
def test_invalid_ids(raw):
    with pytest.raises(AppError) as exc:
        normalize_id(raw)
    assert exc.value.code == "invalid_input"
