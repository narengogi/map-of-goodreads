export const server = process.env.REACT_APP_SERVER_URL;
const version = process.env.REACT_APP_SERVER_VERSION;

const config = {
    vectorTiles: `${server}/${version}/tiles/{z}/{x}/{y}.pbf`,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    edgesBasePath: `${server}/${version}/edges/`
}

export default config;