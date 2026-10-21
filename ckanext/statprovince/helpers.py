import logging
from urllib.parse import quote, urlsplit

import ckan.plugins.toolkit as toolkit
from ckanext.statprovince.provinces import PROVINCE_NAMES

log = logging.getLogger(__name__)


def source_catalog_url(package):
    """Resolve provenance from extras, accepting only ordinary web URLs."""
    extras = {e.get('key'): e.get('value') for e in package.get('extras', [])}
    for key in ('harvest_source_url', 'statprovince_source_url'):
        value = extras.get(key)
        if not isinstance(value, str):
            continue
        value = value.strip()
        try:
            parsed = urlsplit(value)
            if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.password:
                continue
        except ValueError:
            continue
        if key == 'harvest_source_url' and '/dataset/' not in parsed.path:
            path = parsed.path.rstrip('/')
            if not path.endswith('/dataset'):
                path += '/dataset'
            value = parsed._replace(path=path + '/' + quote(package.get('name', ''), safe=''), query='', fragment='').geturl()
        return value
    return None


def visible_labels(labels):
    """Hide province labels in dataset views without changing their metadata."""
    visible = []
    for label in labels or []:
        name = (label.get('title') or label.get('display_name') or label.get('name') or '').strip()
        normalized = name[7:].strip() if name.startswith('จังหวัด') else name
        if normalized in PROVINCE_NAMES or name in ('กรุงเทพฯ', 'กทม.', 'กทม'):
            continue
        visible.append(label)
    return visible

VIS_NETWORK_URL = "https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"


def footer_contact(field):
    defaults = {
        'address': 'สำนักงานสถิติแห่งชาติ\nศูนย์ราชการเฉลิมพระเกียรติ ๘๐ พรรษา อาคาร C ชั้น 5-11\nซ.แจ้งวัฒนะ 7 ถ.แจ้งวัฒนะ เขตหลักสี่ กทม. 10210',
        'phone': '0 2141-7408-9',
        'email': 'gsic@nso.go.th',
    }
    return toolkit.config.get('ckanext.statprovince.footer.' + field, defaults[field])


def vis_network_url():
    """URL ของ vis-network (ตั้งค่าเป็นไฟล์ในเครื่องได้ ถ้าเซิร์ฟเวอร์ไม่มีอินเทอร์เน็ต)"""
    return toolkit.config.get("ckanext.statprovince.vis_network_url", VIS_NETWORK_URL)


def _descendants(node):
    names = []
    for child in node.get("children", []):
        names.append(child["name"])
        names.extend(_descendants(child))
    return names


def top_groups():
    """กลุ่มระดับบนสุด + จำนวนกลุ่มย่อย + จำนวนชุดข้อมูลรวมกลุ่มย่อย (สำหรับ carousel หน้าแรก)

    ใช้ group_tree ของ ckanext-hierarchy ถ้าไม่มีจะใช้ทุกกลุ่มแทน
    """
    context = {"ignore_auth": True}
    try:
        tree = toolkit.get_action("group_tree")(context, {"type": "group"})
    except KeyError:  # ไม่ได้เปิด hierarchy
        tree = [{"name": n, "children": []}
                for n in toolkit.get_action("group_list")(context, {})]
    except Exception:
        log.exception("statprovince: group_tree failed")
        return []

    groups = []
    for node in tree:
        try:
            g = toolkit.get_action("group_show")(context, {
                "id": node["name"], "include_datasets": False, "include_users": False,
                "include_groups": False, "include_extras": False})
        except toolkit.ObjectNotFound:
            continue
        children = _descendants(node)
        names = [node["name"]] + children
        fq = "groups:({})".format(" OR ".join('"{}"'.format(n) for n in names))
        count = toolkit.get_action("package_search")(context, {"fq": fq, "rows": 0})["count"]
        groups.append({
            "name": g["name"],
            "title": g.get("display_name") or g["name"],
            "description": g.get("description") or "",
            "image_url": g.get("image_display_url") or "",
            "child_count": len(node.get("children", [])),
            "dataset_count": count,
        })
    return groups
