from kblight.entity import import_md, assets
from kblight.statement import statements
from kblight.serialize import rdf
from kblight import utilities

import yaml, os

credentials = utilities.json2dict("./config/credentials.json")

source_dir = "./vault/entity"

assets_dir = "./vault/assets"

yaml_dir = "./yaml"

base_url = "https://nicholascorniaorpheus.github.io/tresor-des-demoiselles/entity/"

properties_mapping_path = "./mappings/yaml_properties2lod.csv"

class_mapping_path = "./mappings/yaml_classes2lod.csv"

print("Generating UUID-labels mapping....")
uuid_mapping_index = import_md.generate_label_uuid_mapping(yaml_dir=yaml_dir)

print("Generating URI-labels mapping....")
uri_mapping_index = import_md.generate_label_uri_mapping(
    base_url=base_url, yaml_dir=yaml_dir
)

print("Extracting metadata from Markdown notes, updating existing ones...")
import_md.extract_metadata(
    source_dir=source_dir,
    yaml_dir=yaml_dir,
    update_existing=True,
    mapping_index=uuid_mapping_index,
)

print("Organize statements according to category...")
statements.organize_statements(
    yaml_dir=yaml_dir, properties_mapping_path=properties_mapping_path
)

print("Subsititute wikilinks with URIs")
import_md.substitute_wikilinks(
    base_url=base_url, mapping_index=uri_mapping_index, yaml_dir=yaml_dir
)

print("Add labels to internal URIs...")
statements.add_labels_to_statements(
    base_url=base_url,
    yaml_dir=yaml_dir,
    mapping_index=uri_mapping_index,
)

print("Extract assets files and IIIF manifest...")
assets.extract_assets_from_local_paths(
    yaml_dir=yaml_dir,
    vault_path="./vault",
    vault_base_url=credentials["kblight"]["vault_url"],
)

print("Add default images if absent...")
assets.add_default_image(yaml_dir=yaml_dir, class_mapping_path=class_mapping_path)
