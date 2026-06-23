from kblight.site import jinja, d3_graph
from kblight.entity import assets
from kblight import utilities
from pathlib import Path

credentials = utilities.json2dict("./config/credentials.json")

base_url = credentials["kblight"]["base_url"]

vault_base_url = credentials["kblight"]["vault_url"]

graph_base_url = vault_base_url.replace("/vault", "")

vault_dir = "./vault"

yaml_dir = "./yaml"

graph_dir = "./graph"

print("Generating D3.js compatible graphs JSON...")
d3_graph.generate_global_network(base_url=base_url)

d3_graph.generate_backlinks_graphs(graph_json="./graph.json", graph_dir=graph_dir)

print("Adding graph path to entity's assets...")
assets.add_local_graph_to_assets(
    graph_base_url=graph_base_url, yaml_dir=yaml_dir, graph_dir=graph_dir
)

jinja.generate_mkdocs_pages(
    GITHUB_RAW_BASE=credentials["kblight"]["vault_url"],
    YAML_PATH=Path(yaml_dir),
    OUTPUT_PATH=Path("../docs/entity"),
    TEMPLATE_FILE="./config/entity_template.md.j2",
)
