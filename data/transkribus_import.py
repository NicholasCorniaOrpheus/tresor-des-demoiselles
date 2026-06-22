from pyreslib import transkribus, utilities
from kblight import pagexml2tei
from pathlib import Path


# Getting credentials and Transkribus API session
credentials = utilities.json2dict("./config/credentials.json")

transkribus_session = transkribus.api_login(
    user=credentials["transkribus"]["user"],
    password=credentials["transkribus"]["password"],
)


collection_id = 2353709
document_id = 14756063  # 1857
# document_id = 15041783 # 1859
output_dir = "./vault/assets/OI-20144531"  # 1857
# output_dir = "./vault/assets/OI-20144506" # 1859

# test_xml = Path(output_dir) / "20144531_007.xml"

# order regions
# transkribus.reading_order_document(
#     session=transkribus_session,
#     collection_id=collection_id,
#     document_id=document_id,
#     page_center_method="reference_region",
#     reference_type="page-number",
#     n_columns=2,
# )

# Import JPGs from Transkribus
# transkribus.import_jpg_from_document(
#     session=transkribus_session,
#     collection_id=collection_id,
#     document_id=document_id,
#     output_dir=output_dir,
# )

# Import TXT from Transkribus
# transkribus.import_txt_from_document(
#     session=transkribus_session,
#     collection_id=collection_id,
#     document_id=document_id,
#     output_dir=output_dir,
# )

# # Import PAGEXML from Transkribus
# transkribus.import_pagexml_from_document(
#     session=transkribus_session,
#     collection_id=collection_id,
#     document_id=document_id,
#     output_dir=output_dir,
# )


# pagexml2tei.generate_tei_from_two_column_pagexml(page_xml_path=test_xml)
# pagexml2tei.document_pagexml2tei(document_dir=output_dir)
