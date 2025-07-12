import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import config from "./config";

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
          // map: {
          //   type: 'geojson',
          //   data: config.map,
          // }
          map: {
            type: 'vector',
            tiles: [config.vectorTiles],
            // minzoom: 0,
            maxzoom: 10,
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#ffdea8'
            }
          },
          // {
          //   id: 'map',
          //   type: 'fill',
          //   source: 'map',
          //   'source-layer': 'map',
          //   paint: {
          //     'fill-color': '#000',
          //     'fill-opacity': 0.5,
          //   }
          // },
          {
            id: 'nodes-layer',
            type: 'circle',
            source: 'map',
            'source-layer': 'points-data',
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-radius': 6,
              'circle-color': '#000',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }
          },
          {
            "id": "labels-layer",
            "type": "symbol",
            "source": "map",
            "source-layer": "points-data",
            "layout": {
              "text-field": "{id}",
            }
          }
        ]
      }
    });

    map.on('load', () => {
      map.setProjection({type: 'globe'});
    });

    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
      <div id="map" ref={mapContainer} style={{ width: "100vw", height: "100vh" }}></div>
  );
}

export default App;
