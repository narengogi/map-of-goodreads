![map of goodreads](https://github.com/narengogi/map-of-goodreads/blob/master/public/outmap-of-goodreads.gif?raw=1)
# Brief
- This repository conatins the UI for the map of goodreads
I made it using react and maplibre js
- For the actual code I used to compute the exact similarities between 1.7 million book titles and to cluster them using [240 million rows](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html) of user interactions and the final geojson data, refer to: https://github.com/narengogi/good-earth-data

# Technical Details
okay phew, this actually tool me a lot of time and multiple iterations to make so I'll try to capture the different approaches I used and their failings, maybe an LLM will find this useful

### Top Level Items
1. Find exact similarities between the 1.7 million book titles (this is an n^2 problem) (wrote cuda accelerated code for this)
2. Cluster the books using the similarity scores (I used the [leiden algorithm](https://docs.rapids.ai/api/cugraph/legacy/api_docs/api/cugraph/cugraph.leiden/))
3. Layout the clusters on a world map (I've still not gotten this right I'll need to do this the right way) and generate the geojson tiles
4. Misc things like search and edges rendering

## Deep dive
### Computing similarity scores
Jaccard similarity is a simple metric. We can denote it with J(A, B) = |A ∩ B| / |A ∪ B|.
Now since there are 2 million titles, to find the exact similarities between the 2 million books where each entry is an int that takes up 32 bytes would mean storing 2000000 * 2000000 * 32 / 2 (symmetric matrix) ~= 128 Terabytes of storage :'

My first intuition was to just compute co-occurenrce edges for each book and then trim them to the top 10-20 co-occuring books periodically. But then cooccurence is not a proxy for similarity and this did not work

I also did the same thing in neo4j for no reason without realising I was not really solving the problem

So I figured I need to use sparse matrices in one form or the other. But first I need to clean the data

Now I took a completely useless (unoptimized) path. Two appraoches I used were creating these sparse matrices using user-book and book-user mappings.
So if I have mapping of which users have read each book. I could simply compute similarity by taking an intersection of users for that book with every other book and then just store the top 10 (so this was still nlogn and very compute intensive it got me no where). But this still works and is beautiful, just that it takes a lot of time.
I tried the same the other way around using user-book mapppings instead of book-user mapping.

#### Matrices to the rescue

- For co-occurence I figured you could simply build a sparse user book matrix (A).
- Multiply it with it's own transpose
- Obtain the book x book co-occurence matrix, voila!

So this is what I did finally

- I did some pre-cleaning which was necessary to keep the sparse matrix contained.
Someone with like 10000 books in their shelf makes no meaningful contribution in plotting the similarity between the books (they just tend to read everything and its not useful). I removed the rows of users who read more than 500 books. This also led to the final books dataset dropping from 2.2 million to ~1.7 million which was a loss but it just removes the obscure books which I think is okay for this iteration of the project

- I Split the behaviour data into 4 manageable chunks (In all honesty I could have skipped this step and taken a machine with higher RAM size or written some DAX optimizations or use a larger machine, but I was really just racing to finish the project atp, maybe I'll do it in another iteration). This leads to significant loss in the final output. I should revisit this

- Load the chunks, create sparse matrices, free up some memory, compute co-occurence, divide by count to get the similarity matrix. Trim to keep the top 10 edges for each. save the edges file. phew!


### Clustering the books
For clustering I used leiden algorithm with cugraph and cudf. This was the least challenging part of this project 

### Generating the layout (bin packing)
I still haven't gotten this down perfectly, you'd have noticed that the clusters are quite sparsely laid out (this also needs me to generate tiling data at a very high level of precision (cm)). But I simply coded the simplest rectangle bin packing I could think of. I'll revisit this just for fun atleast. I want to do multiple levels of clustering and then pack them like into continents and countries.

### Misc
- Maplibre is quite accessible tbh. It's intuitive, you can read the docs and figure out most of the knobs and controls. I still haven't gotten the search quite right. I made an interesting workaround where you basically fetch a file containing matching first two letters of your search but it has a few misses I need to normalize the characters in the titles. 

- Not a fan of the colour scheme, but I like contrast so I used this palette.

- Solving for the zoom levels was quite a challenge tbh, the final tiling files for zoom levels upto 15 is around 7GB, it's insane what github gives away for free with GitHub pages lmao. I hope they dont ban my account if there's too much traffic.

## TODO
- [X] Generate tiles for zoom levels greater than 9 / 
alternatively fix the layout so that the points are more spread out and rhe containers are larger
- [ ] Use a library for fuzzy search (there are cases like "Gödel Escher Bach" eith univode characters that dont get searched magbe I should clean these titles)

## Acknowledgements
- Shoutout to UC San Diego for open sourcing the [dataset](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html)
the data is quite old(2017) but its a good starting point. I'll try scraping the data afresh when I have some time
- This project is inspired from [Andrei Kaschas](https://x.com/anvaka?s=21) [Map of Reddit](https://anvaka.github.io/map-of-reddit), which is absolutely 10x better ui
- Also https://vast.ai is a pretty cool platform. I ran all my cuda code on an RTX 5090 and it barely cost me like $4 for end to end experimentation