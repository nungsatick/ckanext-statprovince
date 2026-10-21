import logging

import click
from flask import Blueprint

import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit

from ckanext.statprovince import graph, helpers

log = logging.getLogger(__name__)


# ---------------------------------------------------------------- actions / auth

@toolkit.side_effect_free
def tag_org_graph(context, data_dict):
    """กราฟความสัมพันธ์ Tags (Top 100) กับหน่วยงาน

    GET /api/3/action/statprovince_tag_org_graph
    :param refresh: (sysadmin เท่านั้น) คำนวณใหม่โดยไม่ใช้ cache
    """
    toolkit.check_access("statprovince_tag_org_graph", context, data_dict)
    refresh = toolkit.asbool(data_dict.get("refresh", False))
    if refresh:
        toolkit.check_access("sysadmin", context, data_dict)
    return graph.get_graph(refresh=refresh)


@toolkit.auth_allow_anonymous_access
def tag_org_graph_auth(context, data_dict):
    return {"success": True}


# ---------------------------------------------------------------- blueprint

bp = Blueprint("statprovince", __name__)


@bp.route("/graph")
def graph_page():
    """หน้ากราฟแบบเต็มจอ (แทน /base/html/nw_graph_wlink.html)"""
    return toolkit.render("statprovince/graph.html")


# ---------------------------------------------------------------- CLI

@click.group(name="statprovince", short_help="คำสั่งของ ckanext-statprovince")
def statprovince_cli():
    pass


@statprovince_cli.command("graph-refresh")
def graph_refresh():
    """คำนวณกราฟ Tags x หน่วยงานใหม่และเก็บ cache (ใช้กับ cron ได้)"""
    g = graph.get_graph(refresh=True)
    click.secho("สร้างกราฟแล้ว: {} nodes, {} edges ({})".format(
        len(g["nodes"]), len(g["edges"]), g["generated_at"]), fg="green")


@statprovince_cli.command("graph-clear")
def graph_clear():
    """ลบ cache ของกราฟ"""
    graph.clear_cache()
    click.secho("ลบ cache แล้ว", fg="green")


# ---------------------------------------------------------------- plugin

class StatProvincePlugin(plugins.SingletonPlugin):
    """ส่วนปรับแต่งของ Provincial STAT Catalog (statprovince.gdcatalog.go.th)

    ต้องอยู่ก่อน thai_gdc ใน ckan.plugins เพื่อให้ template ของเราถูกใช้ก่อน
    """

    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.IActions)
    plugins.implements(plugins.IAuthFunctions)
    plugins.implements(plugins.IBlueprint)
    plugins.implements(plugins.ITemplateHelpers)
    plugins.implements(plugins.IClick)

    def update_config(self, config_):
        toolkit.add_template_directory(config_, "templates")
        toolkit.add_public_directory(config_, "public")
        toolkit.add_resource("assets", "statprovince")

    def get_actions(self):
        return {"statprovince_tag_org_graph": tag_org_graph}

    def get_auth_functions(self):
        return {"statprovince_tag_org_graph": tag_org_graph_auth}

    def get_blueprint(self):
        return [bp]

    def get_helpers(self):
        return {
            "statprovince_source_catalog_url": helpers.source_catalog_url,
            "statprovince_visible_labels": helpers.visible_labels,
            "statprovince_footer_contact": helpers.footer_contact,
            "statprovince_top_groups": helpers.top_groups,
            "statprovince_vis_network_url": helpers.vis_network_url,
        }

    def get_commands(self):
        return [statprovince_cli]
