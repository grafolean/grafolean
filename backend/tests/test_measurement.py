import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest

from datatypes import Measurement

@pytest.mark.parametrize("max_points,n_hours,expected", [
    (100, 120, 1,),
    (1000, 120, -1,),
    (359, 120, 0,),
    (120, 120, 0,),
    (119, 120, 1,),
    (40, 120, 1,),
    (39, 120, 2,),

    (120, 120, 0,),
    (120, 41, 0,),
    (120, 40, -1,),
    (120, 10, -1,),
    (120, 121, 1,),
    (120, (3**1) * 120, 1,),
    (120, (3**1) * 120+1, 2,),
    (120, (3**2)*120, 2,),
    (120, (3**2)*120+1, 3,),
    (120, (3**3)*120, 3,),
    (120, (3**3)*120+1, 4,),
    (120, (3**4)*120, 4,),
    (120, (3**4)*120+1, 5,),
    (120, (3**5)*120, 5,),
    (120, (3**5)*120+1, 6,),
    (120, (3**6)*120, 6,),
    (120, (3**6)*120+1, 6,),  # 6 is the highest possible aggregation level
    (120, (3**7)*120, 6,),
])
def test_Measurement_get_aggr_level(max_points, n_hours, expected):
    assert expected == Measurement._get_aggr_level(max_points, n_hours)

