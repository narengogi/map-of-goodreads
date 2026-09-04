import React, { useEffect, useRef, memo, useState } from "react";
import maplibregl, { MapGeoJSONFeature } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import config from "../config";
import "./Map.css";

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
  const selectedBookRef = useRef<MapGeoJSONFeature | null>(selectedBook);
  const edgeDataRef = useRef<FeatureCollection<LineString> | null>(null);
  const edgeGroupIdRef = useRef<string | null>(null);
  const edgeNavigationRef = useRef<{
    edgeKey: string;
    atOtherNode: boolean;
  } | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    selectedBookRef.current = selectedBook;
    edgeNavigationRef.current = null;
  }, [selectedBook]);

  useEffect(() => {
    if (!map || !selectedCoordinates) return;

    const selectNearestBook = () => {
      const point = map.project(selectedCoordinates);
      const radius = 16;
      const features = map.queryRenderedFeatures(
        [
          [point.x - radius, point.y - radius],
          [point.x + radius, point.y + radius],
        ],
        { layers: ["nodes-layer"] }
      );

      const nearestBook = features.reduce<MapGeoJSONFeature | null>(
        (closest, feature) => {
          if (feature.geometry.type !== "Point") return closest;
          if (!closest || closest.geometry.type !== "Point") return feature;

          const featurePoint = map.project(
            feature.geometry.coordinates as [number, number]
          );
          const closestPoint = map.project(
            closest.geometry.coordinates as [number, number]
          );

          return featurePoint.dist(point) < closestPoint.dist(point)
            ? feature
            : closest;
        },
        null
      );

      if (nearestBook) {
        setSelectedBook(nearestBook);
      }
    };

    map.once("idle", selectNearestBook);
    map.flyTo({
      center: selectedCoordinates,
      zoom: 14,
      essential: true, // this animation is considered essential for the user experience
      duration: 1000 // duration of the animation in milliseconds
    });

    return () => {
      map.off("idle", selectNearestBook);
    };
  }, [map, selectedCoordinates, setSelectedBook]);

  useEffect(() => {
    if (!map || !selectedBook) return;
    const selectedGroupId = String(selectedBook.properties.groupId);
    map.setFilter("selected-node-layer", [
      "==",
      ["get", "id"],
      selectedBook.properties.id,
    ]);
    map.setFilter("selected-node-edges-layer", [
      "any",
      ["==", ["get", "source"], selectedBook.properties.id],
    ]);

    const source = map.getSource("edges") as maplibregl.GeoJSONSource;
    const edgeDataUrl = `${config.edgesBasePath}${selectedGroupId}.geojson`;
    const abortController = new AbortController();

    if (
      edgeGroupIdRef.current !== selectedGroupId ||
      !edgeDataRef.current
    ) {
      edgeGroupIdRef.current = selectedGroupId;
      edgeDataRef.current = null;

      fetch(edgeDataUrl, { signal: abortController.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load edges: ${response.status}`);
          }
          return response.json();
        })
        .then((edgeData: FeatureCollection<LineString>) => {
          if (edgeGroupIdRef.current !== selectedGroupId) return;
          edgeDataRef.current = edgeData;
          source.setData(edgeData);
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          console.error("Error fetching edge data:", error);
          source.setData(edgeDataUrl);
        });
    }

    map.setFilter("edges-layer", [
      "all",
      ["==", "$type", "LineString"],
      ["==", "source", selectedBook?.properties.id],
    ]);
    console.log(selectedBook.geometry);
    map.flyTo({
      // @ts-ignore
      center: selectedBook.geometry.coordinates,
      zoom: 14,
      essential: true, // this animation is considered essential for the user experience
      duration: 1000 // duration of the animation in milliseconds
    });

    return () => {
      abortController.abort();
    };
  }, [map, selectedBook]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      hash: true,
      center: [Math.random() * 180 - 90, 45],
      zoom: 2,
      style: {
        version: 8,
        glyphs: config.glyphs,
        
        sources: {
          map: {
            type: "vector",
            tiles: [config.vectorTiles],
            // minzoom: 4,
            maxzoom: 14,
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
              "background-color": "#1E1B16",
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
              "circle-color": "#34D399",
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
              "text-offset": [0, 1.5],
            },
            paint: {
              "text-color": "#E5E7EB"
            }
          },
          {
            id: "selected-node-layer",
            type: "circle",
            source: "map",
            "source-layer": "points-data",
            filter: ["==", "id", "13642"],
            paint: {
              "circle-radius": 10,
              "circle-color": "#34D399",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#F97316",
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
              "line-color": "#D6D3D1",
              "line-width": 2,
            },
          }
        ],
      },
      attributionControl: false,
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

    function findNearestEdge(point: maplibregl.Point) {
      const radius = 6;
      const features = map.queryRenderedFeatures(
        [
          [point.x - radius, point.y - radius],
          [point.x + radius, point.y + radius],
        ],
        { layers: ["edges-layer"] }
      );

      return features[0];
    }

    function navigateAlongEdge(edge: MapGeoJSONFeature) {
      const selected = selectedBookRef.current;
      const fullEdge = edgeDataRef.current?.features.find((feature) => {
        return (
          String(feature.properties?.source) ===
            String(edge.properties?.source) &&
          String(feature.properties?.target) ===
            String(edge.properties?.target)
        );
      });
      const edgeGeometry = fullEdge?.geometry ?? edge.geometry;

      if (
        !selected ||
        selected.geometry.type !== "Point" ||
        edgeGeometry.type !== "LineString" ||
        edgeGeometry.coordinates.length < 2
      ) {
        return;
      }

      const selectedCoordinates = selected.geometry.coordinates as [
        number,
        number
      ];
      const edgeCoordinates = edgeGeometry.coordinates as [number, number][];
      const firstEndpoint = edgeCoordinates[0];
      const lastEndpoint = edgeCoordinates[edgeCoordinates.length - 1];
      const selectedLngLat = maplibregl.LngLat.convert(selectedCoordinates);
      const firstEndpointDistance = selectedLngLat.distanceTo(
        maplibregl.LngLat.convert(firstEndpoint)
      );
      const lastEndpointDistance = selectedLngLat.distanceTo(
        maplibregl.LngLat.convert(lastEndpoint)
      );
      const otherEndpoint =
        firstEndpointDistance > lastEndpointDistance
          ? firstEndpoint
          : lastEndpoint;
      const edgeKey = [
        edge.properties?.source,
        edge.properties?.target,
        otherEndpoint[0],
        otherEndpoint[1],
      ].join(":");
      const previousNavigation = edgeNavigationRef.current;
      const returnToSelectedNode =
        previousNavigation?.edgeKey === edgeKey &&
        previousNavigation.atOtherNode;

      map.flyTo({
        center: returnToSelectedNode
          ? selectedCoordinates
          : otherEndpoint,
        zoom: 14,
        essential: true,
        duration: 1000,
      });

      edgeNavigationRef.current = {
        edgeKey,
        atOtherNode: !returnToSelectedNode,
      };
    }

    map.on("load", () => {
      map.setProjection({ type: "globe" });
    });

    map.on("click", (e) => {
      const nearestCity = findNearestCity(e.point);
      if (nearestCity) {
        setSelectedBook(nearestCity);
        return;
      }

      const nearestEdge = findNearestEdge(e.point);
      if (nearestEdge) {
        navigateAlongEdge(nearestEdge);
      }
    });

    map.on("mouseenter", "edges-layer", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "edges-layer", () => {
      map.getCanvas().style.cursor = "";
    });

    // map.addControl(new maplibregl.AttributionControl({
    //   compact: true,
    //   customAttribution: 'https://github.com/narengogi/map-of-goodreads',
    // }));

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
