import React, { useEffect, useRef, memo, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import config from "../config";

function Map({
  searchQuery,
  setSelectedBook,
}: {
  searchQuery: string;
  setSelectedBook: (book: string) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!map) return;
    console.log(searchQuery);
    const matches = map.queryRenderedFeatures({
      layers: ["selected-node-layer"],
      filter: ["==", "id", String(searchQuery)],
    });
    console.log(matches);
    if (matches.length) {
      map.setFilter("selected-node-layer", ["==", "id", matches[0].properties.id]);
    }
  }, [searchQuery]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      hash: true,
      center: [0, 0],
      zoom: 2,
      style: {
        version: 8,
        glyphs: config.glyphs,
        sources: {
          map: {
            type: "vector",
            tiles: [config.vectorTiles],
            // minzoom: 0,
            maxzoom: 10,
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
              "text-field": "{id}",
              "text-offset": [0, 1],
            },
          },
          {
            id: "edges-layer",
            type: "line",
            source: "map",
            "source-layer": "points-data",
            filter: ["==", "$type", "LineString"],
            minzoom: 7,
            layout: {
              "line-cap": "round",
              "line-join": "round",
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
      console.log(nearestCity);
      const id = nearestCity.properties.id;
      // open contextmenu
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
