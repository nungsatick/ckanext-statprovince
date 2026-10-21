from setuptools import setup, find_packages

with open("README.md", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="ckanext-statprovince",
    version="0.1.0",
    description="Provincial STAT Catalog customizations for CKAN-OpenD (thai_gdc)",
    long_description=long_description,
    long_description_content_type="text/markdown",
    license="AGPL-3.0",
    classifiers=[
        "Framework :: CKAN",
        "License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)",
        "Programming Language :: Python :: 3",
    ],
    python_requires=">=3.8",
    packages=find_packages(exclude=["docker"]),
    namespace_packages=["ckanext"],
    include_package_data=True,
    zip_safe=False,
    entry_points="""
        [ckan.plugins]
        statprovince=ckanext.statprovince.plugin:StatProvincePlugin
    """,
)
