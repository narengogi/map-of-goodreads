#!/usr/bin/env bash

set -euo pipefail

repository="narengogi/good-earth-data"
branch="master"
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

upload_file() {
  local source_path="$1"
  local destination_path="$2"
  local message="$3"
  local existing_sha
  local content
  local -a arguments

  existing_sha="$(
    gh api "repos/${repository}/contents/${destination_path}?ref=${branch}" \
      --jq '.sha' 2>/dev/null || true
  )"
  content="$(base64 < "$source_path" | tr -d '\n')"

  arguments=(
    --method PUT
    "repos/${repository}/contents/${destination_path}"
    -f "message=${message}"
    -f "content=${content}"
    -f "branch=${branch}"
  )

  if [ -n "$existing_sha" ]; then
    arguments+=(-f "sha=${existing_sha}")
  fi

  gh api "${arguments[@]}" >/dev/null
  echo "Uploaded ${destination_path}"
}

upload_file \
  "${script_directory}/build-search-index.mjs" \
  "scripts/search_index/build-search-index.mjs" \
  "Add enriched search index generator"

upload_file \
  "${script_directory}/generate-search-index.yml" \
  ".github/workflows/generate-search-index.yml" \
  "Add enriched search index workflow"

gh workflow run generate-search-index.yml \
  --repo "$repository" \
  --ref "$branch" \
  -f tile_limit=1 \
  -f max_shard_kb=750 \
  -f publish=false

echo "Uploaded backend files and started the one-tile pilot workflow."
