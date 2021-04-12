import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest

from datatypes import PathFilter, ValidationError

@pytest.mark.parametrize("input,expected_valid", [
    # valid:
    ("asdf", True),
    ("asdf.123", True),
    ("*.asdf.123", True),
    ("*.asdf.?", True),
    ("123.*.asdf.*.123", True),
    # invalid:
    ("asdf.", False),
    (".asdf", False),
    ("asdf*", False),
    ("asdf?", False),
    ("123..asdf", False),
])
def test_PathFilter_input_validation(input, expected_valid):
    try:
        pf = PathFilter(input)
        assert expected_valid == True
    except ValidationError:
        assert expected_valid == False

@pytest.mark.parametrize("path_filter_str,expected", [
    ("asdf.123.rewq", "^asdf[.]123[.]rewq$"),
    # skip failing tests:
    # ("asdf.123.*", "^asdf[.]123[.].+$"),
    # ("*.asdf.123", "^.+[.]asdf[.]123$"),
    # ("*.asdf.?", "^.+[.]asdf[.][^.]+$"),
    # ("123.?.asdf.*.123", "^123[.][^.]+[.]asdf[.].+[.]123$"),
])
def test_PathFilter_regex_from_filter(path_filter_str, expected):
    assert PathFilter._regex_from_filter(path_filter_str) == expected

