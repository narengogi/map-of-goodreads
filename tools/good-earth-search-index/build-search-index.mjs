#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Pbf from "pbf";
import vectorTilePackage from "@mapbox/vector-tile";

const { VectorTile } = vectorTilePackage;

const DEFAULT_MAX_SHARD_BYTES = 750 * 1024;
const DEFAULT_MAX_PREFIX_LENGTH = 8;
const SEARCH_SCHEMA = [
  "searchKey",
  "id",
  "title",
  "authors",
  "publicationYear",
  "longitude",
  "latitude",
  "averageRating",
  "popularity",
  "groupId",
  "publisher",
];

function parseArguments(argv) {
  const options = {
    tilesRoot: "",
    outputRoot: "",
    legacyRoot: "",
    maxShardBytes: DEFAULT_MAX_SHARD_BYTES,
    maxPrefixLength: DEFAULT_MAX_PREFIX_LENGTH,
    limitTiles: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    switch (argument) {
      case "--tiles-root":
        options.tilesRoot = value;
        index += 1;
        break;
      case "--output":
        options.outputRoot = value;
        index += 1;
        break;
      case "--legacy-root":
        options.legacyRoot = value;
        index += 1;
        break;
      case "--max-shard-bytes":
        options.maxShardBytes = Number(value);
        index += 1;
        break;
      case "--max-prefix-length":
        options.maxPrefixLength = Number(value);
        index += 1;
        break;
      case "--limit-tiles":
        options.limitTiles = Number(value);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.tilesRoot || !options.outputRoot) {
    throw new Error(
      "Usage: build-search-index.mjs --tiles-root <z14 directory> --output <directory> [--legacy-root <directory>] [--limit-tiles <count>]"
    );
  }

  if (
    !Number.isFinite(options.maxShardBytes) ||
    options.maxShardBytes <= 0
  ) {
    throw new Error("--max-shard-bytes must be a positive number");
  }

  return options;
}

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function removeLeadingArticle(value) {
  return value.replace(/^(?:the|an|a)\s+/, "");
}

function listTileFiles(root) {
  const tileFiles = [];

  for (const xEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!xEntry.isDirectory() || !/^\d+$/.test(xEntry.name)) continue;

    const xDirectory = path.join(root, xEntry.name);
    for (const yEntry of fs.readdirSync(xDirectory, {
      withFileTypes: true,
    })) {
      if (!yEntry.isFile() || !yEntry.name.endsWith(".pbf")) continue;
      tileFiles.push({
        path: path.join(xDirectory, yEntry.name),
        x: Number(xEntry.name),
        y: Number(path.basename(yEntry.name, ".pbf")),
      });
    }
  }

  tileFiles.sort((left, right) => {
    return left.x - right.x || left.y - right.y;
  });
  return tileFiles;
}

function compactRecord(properties, coordinates) {
  return [
    String(properties.id),
    String(properties.title),
    String(properties.author_names ?? ""),
    String(properties.publication_year ?? ""),
    coordinates[0],
    coordinates[1],
    properties.average_rating ?? "",
    properties.size ?? 0,
    properties.groupId ?? "",
    String(properties.publisher ?? ""),
  ];
}

function extractRecords(tileFiles, limitTiles) {
  const recordsById = new Map();
  const selectedTiles =
    limitTiles > 0 ? tileFiles.slice(0, limitTiles) : tileFiles;

  selectedTiles.forEach((tileFile, tileIndex) => {
    const tile = new VectorTile(
      new Pbf(fs.readFileSync(tileFile.path))
    );
    const layer = tile.layers["points-data"];

    if (!layer) return;

    for (let featureIndex = 0; featureIndex < layer.length; featureIndex += 1) {
      const feature = layer.feature(featureIndex);
      const properties = feature.properties;
      if (!properties.id || !properties.title) continue;

      const id = String(properties.id);
      if (recordsById.has(id)) continue;

      const geojson = feature.toGeoJSON(tileFile.x, tileFile.y, 14);
      if (geojson.geometry.type !== "Point") continue;

      recordsById.set(
        id,
        compactRecord(properties, geojson.geometry.coordinates)
      );
    }

    if (
      tileIndex === selectedTiles.length - 1 ||
      (tileIndex + 1) % 1000 === 0
    ) {
      console.log(
        `Processed ${tileIndex + 1}/${selectedTiles.length} tiles; ${recordsById.size} unique books`
      );
    }
  });

  return {
    records: [...recordsById.values()],
    processedTiles: selectedTiles.length,
    availableTiles: tileFiles.length,
  };
}

function createIndexEntries(records, indexType) {
  const entries = [];

  for (const record of records) {
    const [, title, authors] = record;
    const fullTitleKey = normalizeSearchText(title);

    if (indexType === "title") {
      if (!fullTitleKey) continue;
      entries.push([fullTitleKey, ...record]);

      const articlelessKey = removeLeadingArticle(fullTitleKey);
      if (articlelessKey && articlelessKey !== fullTitleKey) {
        entries.push([articlelessKey, ...record]);
      }
      continue;
    }

    const authorKey = normalizeSearchText(authors);
    if (authorKey) {
      entries.push([authorKey, ...record]);
    }
  }

  entries.sort((left, right) => {
    return (
      left[0].localeCompare(right[0]) ||
      Number(right[8] || 0) - Number(left[8] || 0)
    );
  });

  return entries;
}

function shardFileName(prefix, part) {
  const hash = crypto
    .createHash("sha1")
    .update(prefix || "__empty__")
    .digest("hex")
    .slice(0, 16);
  return `${hash}-${part}.json`;
}

function serializedSize(entries) {
  return Buffer.byteLength(JSON.stringify(entries));
}

function writeAdaptiveShards({
  entries,
  indexType,
  outputRoot,
  maxShardBytes,
  maxPrefixLength,
}) {
  const indexRoot = path.join(outputRoot, indexType);
  fs.mkdirSync(indexRoot, { recursive: true });

  const routes = {};
  let shardCount = 0;
  let largestShardBytes = 0;

  function writeShard(prefix, shardEntries, part = 0) {
    const fileName = shardFileName(prefix, part);
    const relativePath = `${indexType}/${fileName}`;
    const serialized = JSON.stringify(shardEntries);
    fs.writeFileSync(path.join(outputRoot, relativePath), serialized);

    routes[prefix] ??= [];
    routes[prefix].push(relativePath);
    shardCount += 1;
    largestShardBytes = Math.max(
      largestShardBytes,
      Buffer.byteLength(serialized)
    );
  }

  function partition(prefix, shardEntries) {
    if (
      serializedSize(shardEntries) <= maxShardBytes ||
      prefix.length >= maxPrefixLength
    ) {
      let part = 0;
      let currentPart = [];
      let currentBytes = 2;

      for (const entry of shardEntries) {
        const entryBytes = Buffer.byteLength(JSON.stringify(entry)) + 1;
        if (
          currentPart.length > 0 &&
          currentBytes + entryBytes > maxShardBytes
        ) {
          writeShard(prefix, currentPart, part);
          part += 1;
          currentPart = [];
          currentBytes = 2;
        }
        currentPart.push(entry);
        currentBytes += entryBytes;
      }

      if (currentPart.length > 0) {
        writeShard(prefix, currentPart, part);
      }
      return;
    }

    const groups = new Map();
    for (const entry of shardEntries) {
      const nextCharacter = entry[0][prefix.length] ?? "";
      const childPrefix = `${prefix}${nextCharacter}`;
      if (!groups.has(childPrefix)) groups.set(childPrefix, []);
      groups.get(childPrefix).push(entry);
    }

    if (groups.size === 1 && groups.has(prefix)) {
      writeShard(prefix, shardEntries);
      return;
    }

    for (const [childPrefix, childEntries] of groups) {
      partition(childPrefix, childEntries);
    }
  }

  const topLevelGroups = new Map();
  for (const entry of entries) {
    const prefix = entry[0][0] ?? "";
    if (!topLevelGroups.has(prefix)) topLevelGroups.set(prefix, []);
    topLevelGroups.get(prefix).push(entry);
  }

  for (const [prefix, prefixEntries] of topLevelGroups) {
    partition(prefix, prefixEntries);
  }

  return {
    routes,
    shardCount,
    largestShardBytes,
    entryCount: entries.length,
  };
}

function countLegacyEntries(legacyRoot) {
  if (!legacyRoot || !fs.existsSync(legacyRoot)) return null;

  let count = 0;
  for (const entry of fs.readdirSync(legacyRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const records = JSON.parse(
      fs.readFileSync(path.join(legacyRoot, entry.name), "utf8")
    );
    count += records.length;
  }
  return count;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const resolvedOutputRoot = path.resolve(options.outputRoot);
  const protectedPaths = new Set([
    path.parse(resolvedOutputRoot).root,
    path.resolve(process.cwd()),
    path.resolve(options.tilesRoot),
  ]);

  if (protectedPaths.has(resolvedOutputRoot)) {
    throw new Error(`Refusing to replace unsafe output path: ${resolvedOutputRoot}`);
  }

  const tileFiles = listTileFiles(options.tilesRoot);

  if (tileFiles.length === 0) {
    throw new Error(`No PBF tiles found beneath ${options.tilesRoot}`);
  }

  fs.rmSync(options.outputRoot, { recursive: true, force: true });
  fs.mkdirSync(options.outputRoot, { recursive: true });

  const extraction = extractRecords(tileFiles, options.limitTiles);
  const titleEntries = createIndexEntries(extraction.records, "title");
  const authorEntries = createIndexEntries(extraction.records, "author");
  const titleIndex = writeAdaptiveShards({
    entries: titleEntries,
    indexType: "title",
    outputRoot: options.outputRoot,
    maxShardBytes: options.maxShardBytes,
    maxPrefixLength: options.maxPrefixLength,
  });
  const authorIndex = writeAdaptiveShards({
    entries: authorEntries,
    indexType: "author",
    outputRoot: options.outputRoot,
    maxShardBytes: options.maxShardBytes,
    maxPrefixLength: options.maxPrefixLength,
  });
  const legacyEntryCount = countLegacyEntries(options.legacyRoot);

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    schema: SEARCH_SCHEMA,
    normalization: "unicode-nfkd-v1",
    maxShardBytes: options.maxShardBytes,
    indexes: {
      title: titleIndex,
      author: authorIndex,
    },
    stats: {
      uniqueBooks: extraction.records.length,
      processedTiles: extraction.processedTiles,
      availableTiles: extraction.availableTiles,
      legacyEntryCount,
      coverage:
        legacyEntryCount && options.limitTiles === 0
          ? extraction.records.length / legacyEntryCount
          : null,
    },
  };

  fs.writeFileSync(
    path.join(options.outputRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log(JSON.stringify(manifest.stats, null, 2));
}

main();
