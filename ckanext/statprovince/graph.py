"""กราฟความสัมพันธ์ Tags x หน่วยงาน (แทนไฟล์ nw_graph_wlink.html ที่เคย generate แบบ static)

คำนวณจาก package_search (เฉพาะชุดข้อมูลสาธารณะ) แล้ว cache ไว้ใน Redis
ตามเวลาที่กำหนดใน ckanext.statprovince.graph.cache_ttl (วินาที, ค่าเริ่มต้น 3600)
"""
import datetime
import json
import logging
from collections import Counter

import ckan.plugins.toolkit as toolkit
from ckan.lib.redis import connect_to_redis

log = logging.getLogger(__name__)

CACHE_KEY = "ckanext.statprovince:tag_org_graph:v1"
MAX_TAGS = 100
PAGE_SIZE = 1000


def cache_ttl():
    return toolkit.asint(toolkit.config.get("ckanext.statprovince.graph.cache_ttl", 3600))


def _search(data_dict):
    # ignore_auth + include_private=False: ผลลัพธ์เหมือนผู้ใช้ทั่วไปเห็น จึง cache ร่วมกันได้
    context = {"ignore_auth": True}
    data_dict = dict(data_dict, include_private=False)
    return toolkit.get_action("package_search")(context, data_dict)


def build_graph(max_tags=MAX_TAGS):
    """คำนวณ nodes/edges ใหม่จากข้อมูลจริง"""
    tag_counts = Counter()
    pair_counts = Counter()  # (org_name, tag) -> จำนวนชุดข้อมูล
    org_counts = Counter()

    start = 0
    while True:
        res = _search({"q": "*:*", "rows": PAGE_SIZE, "start": start,
                       "fl": "name,organization,tags"})
        for pkg in res["results"]:
            org = pkg.get("organization")
            tags = set(pkg.get("tags") or [])
            tag_counts.update(tags)
            if org:
                org_counts[org] += 1
                pair_counts.update((org, t) for t in tags)
        start += PAGE_SIZE
        if start >= res["count"]:
            break

    # ชื่อแสดงผลของหน่วยงานจาก facet (ไม่ติดเพดาน organization_list all_fields)
    facets = _search({"rows": 0, "facet.field": ["organization"], "facet.limit": -1})
    org_titles = {i["name"]: i["display_name"]
                  for i in facets["search_facets"].get("organization", {}).get("items", [])}

    top_tags = [t for t, _ in sorted(tag_counts.items(), key=lambda x: (-x[1], x[0]))[:max_tags]]
    rank = {t: i + 1 for i, t in enumerate(top_tags)}

    nodes, edges, used_orgs = [], [], set()
    for (org, tag), n in pair_counts.items():
        if tag in rank:
            used_orgs.add(org)
            edges.append({"from": "org:" + org, "to": "tag:" + tag, "value": n,
                          "rank": rank[tag]})

    for org in sorted(used_orgs):
        title = org_titles.get(org, org)
        nodes.append({"id": "org:" + org, "group": "Organization", "slug": org,
                      "label": title, "value": org_counts[org],
                      "title": "{} ({} ชุดข้อมูล)".format(title, org_counts[org])})
    for tag in top_tags:
        nodes.append({"id": "tag:" + tag, "group": "Tag", "slug": tag, "rank": rank[tag],
                      "label": "{} ({})".format(tag, tag_counts[tag]),
                      "value": tag_counts[tag],
                      "title": "คำค้น: {} — {} ชุดข้อมูล".format(tag, tag_counts[tag])})

    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "max_tags": max_tags,
        "dataset_count": sum(org_counts.values()),
        "nodes": nodes,
        "edges": edges,
    }


def get_graph(refresh=False):
    """อ่านจาก cache ถ้ามี ไม่มีหรือ refresh=True จะคำนวณใหม่แล้วเก็บ cache"""
    redis = None
    try:
        redis = connect_to_redis()
        if not refresh:
            cached = redis.get(CACHE_KEY)
            if cached:
                return json.loads(cached)
    except Exception:
        log.warning("statprovince: Redis ใช้งานไม่ได้ จะคำนวณกราฟโดยไม่ใช้ cache", exc_info=True)
        redis = None

    graph = build_graph()
    if redis is not None:
        try:
            redis.setex(CACHE_KEY, cache_ttl(), json.dumps(graph, ensure_ascii=False))
        except Exception:
            log.warning("statprovince: บันทึก cache ไม่สำเร็จ", exc_info=True)
    return graph


def clear_cache():
    connect_to_redis().delete(CACHE_KEY)
