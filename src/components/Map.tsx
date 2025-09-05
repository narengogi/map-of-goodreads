import React, { useEffect, useRef, memo, useState } from "react";
import maplibregl, { MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import config from "../config";

function Map({
  selectedBook,
  setSelectedBook,
  selectedCoordinates,
}: {
  selectedBook: MapGeoJSONFeature | null;
  setSelectedBook: (book: MapGeoJSONFeature | null) => void;
  selectedCoordinates: [number, number] | null;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!map || !selectedCoordinates) return;
    map.setCenter(selectedCoordinates);
    map.setZoom(8);
  }, [selectedCoordinates]);

  useEffect(() => {
    if (!map || !selectedBook) return;
    const selectedGroupId = selectedBook.properties.groupId;
    map.setFilter("selected-node-layer", [
      "==",
      ["get", "id"],
      selectedBook.properties.id,
    ]);
    map.setFilter("selected-node-edges-layer", [
      "any",
      ["==", ["get", "source"], selectedBook.properties.id],
    ]);

    const source = map.getSource("edges");
    // @ts-ignore
    if (source._data.split("_")[1].split(".")[0] != selectedGroupId) {
      // @ts-ignore
      source.setData(
        `${config.edgesBasePath}subgraph_${selectedGroupId}.geojson`
      );
    }
    map.setFilter("edges-layer", [
      "all",
      ["==", "$type", "LineString"],
      ["==", "source", selectedBook?.properties.id],
    ]);
  }, [selectedBook]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      hash: true,
      center: [0, 0],
      zoom: 4,
      style: {
        version: 8,
        glyphs: config.glyphs,
        sources: {
          map: {
            type: "vector",
            tiles: [config.vectorTiles],
            // minzoom: 4,
            maxzoom: 8,
          },
          edges: {
            type: "geojson",
            data: `${config.edgesBasePath}subgraph_1.geojson`,
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#ffdea8",
            },
          },
          {
            id: "nodes-layer",
            type: "circle",
            source: "map",
            "source-layer": "points-data",
            filter: ["==", "$type", "Point"],
            paint: {
              "circle-radius": 6,
              "circle-color": "#000",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          },
          {
            id: "labels-layer",
            type: "symbol",
            source: "map",
            "source-layer": "points-data",
            layout: {
              "text-field": "{title}",
              "text-offset": [0, 1],
            },
          },
          {
            id: "selected-node-layer",
            type: "circle",
            source: "map",
            "source-layer": "points-data",
            filter: ["==", "id", "13642"],
            paint: {
              "circle-radius": 10,
              "circle-color": "#000",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          },
          {
            id: "edges-layer",
            type: "line",
            source: "edges",
            filter: [
              "all",
              ["==", "$type", "LineString"],
              ["==", "source", "00000"],
            ],
            paint: {
              "line-color": "#000",
              "line-width": 2,
            },
          }
        ],
      },
    });

    function findNearestCity(point: maplibregl.Point) {
      let width = 16;
      let height = 16;
      const features = map.queryRenderedFeatures(
        [
          [point.x - width / 2, point.y - height / 2],
          [point.x + width / 2, point.y + height / 2],
        ],
        { layers: ["nodes-layer"] }
      );
      if (!features.length) return;
      let distance = Infinity;
      let nearestCity = null;
      return features[0];
      // console.log(features);
      // features.forEach((feature) => {
      //   let bbox = feature.geometry?.bbox;
      //   if (!bbox) return;
      //   let dx = bbox[0] - point.x;
      //   let dy = bbox[1] - point.y;
      //   let d = dx * dx + dy * dy;
      //   if (d < distance) {
      //     distance = d;
      //     nearestCity = feature;
      //   }
      // });
      // return nearestCity;
    }

    map.on("load", () => {
      map.setProjection({ type: "globe" });
    });

    map.on("click", (e) => {
      const nearestCity = findNearestCity(e.point);
      if (!nearestCity) return;
      setSelectedBook(nearestCity);
    });

    mapRef.current = map;
    setMap(map);

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div
      id="map"
      ref={mapContainer}
      style={{ width: "100vw", height: "100vh" }}
    ></div>
  );
}

export default memo(Map);
