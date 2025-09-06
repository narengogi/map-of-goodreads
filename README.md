# Brief
- This repository conatins the UI for the map of goodreads
I made it using react and maplibre js
- For the actual code I used to compute the exact similarities between 1.7 million book titles and to cluster the [240 million rows](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html) of data 
and the final geojson data that is being served is available at https://github.com/narengogi/good-earth-data

# Technical Details
okay phew, this did take me a lot of time and multiple iterations to make so I'll try to capture the different approaches I used and their failings, maybe an llm will find this useful

### Top Level Items
1. Find exact similarities between the 1.7 million book titles (this is an n^2 problem)
2. Cluster the books using the similarity scores
3. Layout the clusters on a world map (I've still not gotten this right I'll need to do this the right way) and generate the geojson tiles
4. Misc things like search and edges rendering

## Deep dive
### Computing similarity scores
### Clustering the books
### Generating the layout (bin packing)
### Misc

## TODO
- [ ] Generate tiles for zoom levels greater than 9 / 
alternatively fix the layout so that the points are more spread out and rhe containers are larger
- [ ] Use a library fir fuzzy search (there are cases like "Gödel Escher Bach" eith univode characters that dont get searched magbe I should clean these titles)

## Acknowledgements
- Shoutout to UC San Diego for open sourcing the [dataset](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html)
the data is quite old(2017) but its a good starting point. I'll try scraping the data afresh when I have some time
- This prohect is originally inspired from [Andrei Kaschas](https://x.com/anvaka?s=21) [Map of Reddit](https://anvaka.github.io/map-of-reddit), which is absolutely 10x better ui and better made