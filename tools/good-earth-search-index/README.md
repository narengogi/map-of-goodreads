# Good Earth enriched search index

These files are staged for `narengogi/good-earth-data` without cloning that
repository locally.

## Backend locations

- `build-search-index.mjs` → `scripts/search_index/build-search-index.mjs`
- `generate-search-index.yml` →
  `.github/workflows/generate-search-index.yml`
- `publish-backend-files.sh` uploads both files without cloning the backend
  repository and starts the one-tile pilot.

## Rollout

1. Run `./tools/good-earth-search-index/publish-backend-files.sh`.
2. The script uploads both files to `good-earth-data` and starts the workflow
   with `tile_limit=1` and `publish=false`.
3. Inspect the artifact and manifest.
4. Run with `tile_limit=0` and `publish=false`.
5. Verify full-index coverage against the legacy search entry count.
6. Run with `tile_limit=0` and `publish=true`.
7. Update the frontend to consume `v2/search/manifest.json`.

The generated index excludes descriptions to keep search payloads small.
