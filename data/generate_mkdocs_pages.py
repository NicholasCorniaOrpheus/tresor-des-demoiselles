from kblight.site import jinja
from kblight import utilities
from pathlib import Path

credentials = utilities.json2dict("./config/credentials.json")

vault_dir = "./vault"

yaml_dir = "./yaml"

jinja.generate_mkdocs_pages(
    GITHUB_RAW_BASE=credentials["kblight"]["vault_url"],
    YAML_PATH=Path(yaml_dir),
    OUTPUT_PATH=Path("../docs"),
    TEMPLATE_FILE="./config/entity_template.md.j2",
)
