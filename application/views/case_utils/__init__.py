from .case_oct import CaseOCT
from .case_stl import CaseSTL

from ..utils.config_utils import config

def get_case_util(dataname):
    if dataname.lower() == config.stl.lower():
        return CaseSTL()
    elif dataname.lower() == config.oct.lower():
        return CaseOCT()
    else:
        raise ValueError("unsupport dataname {}".format(dataname))