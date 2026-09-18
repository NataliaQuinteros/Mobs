#!/usr/bin/env bash
# Builds the local copy of OpenStreetMap places, so searches don't depend on the public Overpass server.
# Run inside WSL (needs osmium-tool):  bash scripts/build-places.sh
# Afterwards, on Windows:              npx tsx scripts/import-places.ts
set -euo pipefail

REGION=${REGION:-europe}                                    # any Geofabrik extract name
WORK_DIR=${WORK_DIR:-/mnt/c/osm-data}                       # outside OneDrive: these files are large
EXTRACT=${EXTRACT:-$HOME/osm/$REGION-latest.osm.pbf}

mkdir -p "$WORK_DIR"

if [ ! -f "$EXTRACT" ]; then
  echo "Downloading $REGION (this is tens of GB)…"
  mkdir -p "$(dirname "$EXTRACT")"
  wget -c -O "$EXTRACT" "https://download.geofabrik.de/$REGION-latest.osm.pbf"
fi

echo "Keeping only places that have a website tag…"
osmium tags-filter --overwrite --progress \
  "$EXTRACT" nwr/website nwr/contact:website nwr/brand:website nwr/url \
  -o "$WORK_DIR/with-website.osm.pbf"

echo "Exporting them with coordinates…"
osmium export --overwrite --progress \
  --add-unique-id=type_id --geometry-types=point,linestring,polygon \
  -f geojsonseq "$WORK_DIR/with-website.osm.pbf" -o "$WORK_DIR/places.geojsonseq"

rm -f "$WORK_DIR/with-website.osm.pbf"
ls -lh "$WORK_DIR/places.geojsonseq"
echo "Done. Now run on Windows:  cd backend && npx tsx scripts/import-places.ts"
