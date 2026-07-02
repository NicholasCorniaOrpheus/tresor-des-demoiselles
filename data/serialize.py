from kblight.serialize import rdf_serialization, json_serialization, csv_serialization
from kblight import utilities

from pathlib import Path


credentials = utilities.json2dict("./config/credentials.json")

namespaces = utilities.json2dict("./mappings/namespaces.json")

source_dir = "./vault/entity"

assets_dir = "./vault/assets"

yaml_dir = "./yaml"

base_url = "https://nicholascorniaorpheus.github.io/tresor-des-demoiselles/entity/"

properties_mapping_path = "./mappings/yaml_properties2lod.csv"

class_mapping_path = "./mappings/yaml_classes2lod.csv"

print("Serialize in JSON format...")
json_serialization.yaml_metadata_to_json()

print("Serialization in CSV format...")
csv_serialization.flatten_json_entities_to_csv()

print("Serializing in RDF format...")
yaml_dir = Path(yaml_dir)
for file in yaml_dir.glob("*.y*ml"):
    rdf_serialization.rdf_serialization(
        entity=utilities.yaml2dict(file),
        kblight_namespace=namespaces[0][
            "namespace"
        ],  # we assume the first namespace is the one of the repository
    )
