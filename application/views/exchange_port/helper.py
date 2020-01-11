from .ExchangePort import ExchangePortClass

exchange_port = ExchangePortClass()


def set_dataname(dataname):
    exchange_port.reset_dataname(dataname)


def set_model(dataname, labeled_num=None, total_num=None):
    exchange_port.reset_model(dataname, labeled_num, total_num)


def init_model(k, filter_threshold):
    exchange_port.init_model(k=k, filter_threshold=filter_threshold)

def get_graph(filter_threshold=None):
    return exchange_port.get_graph(filter_threshold=filter_threshold)


def get_manifest():
    return exchange_port.get_manifest()


def get_loss():
    return exchange_port.get_loss()


def get_ent():
    return exchange_port.get_ent()

def get_flows():
    return exchange_port.get_flows()


def get_labels():
    return exchange_port.get_labels()


def get_image_path(id):
    return exchange_port.get_image_path(id)

def update_graph(area, level):
    return exchange_port.update_graph(area, level)

def get_area(must_show_nodes, width, height):
    return exchange_port.get_area(must_show_nodes, width, height)

def update_delete_and_change_label(delete_node_list, change_list, delete_edge):
    return exchange_port.update_delete_and_change_label(delete_node_list, change_list, delete_edge)

def fisheye(must_show_nodes, area, level):
    return exchange_port.fisheye(must_show_nodes, area, level)