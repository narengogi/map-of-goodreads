const server = "http://localhost:8787";
const version = "v1";

export default {
    map: `${server}/${version}/map.geojson`,
    vectorTiles: `${server}/${version}/tiles/{z}/{x}/{y}.pbf`,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
}