import React, { useEffect, useRef, memo, useState } from "react";
import maplibregl, { MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import config from "../config";

function Map({
  searchQuery,
  selectedBook,
  setSelectedBook,
}: {
  searchQuery: string;
  selectedBook: MapGeoJSONFeature | null;
  setSelectedBook: (book: MapGeoJSONFeature | null) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !selectedBook) return;
    map.setFilter("selected-node-layer", ["==", ["get", "id"], selectedBook.properties.id]);
    if (selectedGroup != selectedBook.properties.groupId) {
      setSelectedGroup(selectedBook.properties.groupId);
      
    }
    map.setFilter("selected-node-edges-layer", ["any", ["==", ["get", "source"], selectedBook.properties.id], ["==", ["get", "target"], selectedBook.properties.id]]);
  }, [selectedBook]);

  useEffect(() => {
    if (!map || !selectedGroup) return;
    if (map.getSource("edges")) {
      map.removeSource("edges");
      map.removeLayer("edges-layer");
    }
    map.addSource("edges", {
      type: "geojson",
      data: `${config.edgesBasePath}edges_${selectedGroup}.geojson`,
    });
    map.addLayer({
      id: "edges-layer",
      type: "line",
      source: "edges",
      paint: {
        "line-color": "#000",
        "line-width": 2,
      },
    });
  }, [selectedGroup]);

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
            // minzoom: 4,
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
            id: "selected-node-edges-layer",
            type: "line",
            source: "map",
            "source-layer": "points-data",
            filter: ["==", "$id", "00000"],
            paint: {
              "line-color": "#000",
              "line-width": 2,
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
      // console.log(nearestCity);
      setSelectedBook(nearestCity);
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
