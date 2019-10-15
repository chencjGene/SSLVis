from .ExchangePort import ExchangePortClass

exchange_port = ExchangePortClass()

def set_dataname(dataname):
    exchange_port.reset_dataname(dataname)

def get_graph():
    return exchange_port.get_graph()

def get_manifest():
    return exchange_port.get_manifest()