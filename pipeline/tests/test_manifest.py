import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from nisar_pipeline.manifest import Manifest

FIXTURE = Path(__file__).parent / "fixtures" / "manifest.sample.json"


def test_fixture_validates():
    m = Manifest.model_validate_json(FIXTURE.read_text())
    assert m.schemaVersion == 2
    assert [r.id for r in m.regions] == ["mexicali", "tijuana"]


def test_rejects_unknown_source():
    data = json.loads(FIXTURE.read_text())
    data["regions"][0]["layers"][0]["source"] = "landsat"
    with pytest.raises(ValidationError):
        Manifest.model_validate(data)


def test_rejects_extra_fields():
    data = json.loads(FIXTURE.read_text())
    data["regions"][0]["oops"] = 1
    with pytest.raises(ValidationError):
        Manifest.model_validate(data)
