from kblight.entity import import_md

from kblight.serialize import rdf

from kblight import utilities

import yaml, os


source_dir = "./data/tresor_des_demoiselles/entity"

base_url = "https://nicholascorniaorpheus.github.io/tresor-des-demoiselles/entity/"


def cleanup_data():
    for file in os.scandir("./data/yaml"):
        os.remove(file.path)

    for file in os.scandir("./data/json"):
        os.remove(file.path)

    for file in os.scandir("./data/rdf"):
        os.remove(file.path)


print("Cleaning up all data. Press Enter to continue...")
input()
cleanup_data()

import_md.extract_metadata(source_dir=source_dir)

mapping_index = import_md.generate_label_uuid_mapping(base_url=base_url)

import_md.substitute_wikilinks(base_url=base_url, mapping_index=mapping_index)

import_md.add_labels_to_entities(base_url=base_url, mapping_index=mapping_index)
