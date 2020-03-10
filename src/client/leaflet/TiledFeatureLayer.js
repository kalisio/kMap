import L from 'leaflet'

function tileToBounds(map, coords, tileSize) {
    const pixelCoords0 = L.point(coords.x * tileSize.x, coords.y * tileSize.y)
    const pixelCoords1 = L.point(pixelCoords0.x + tileSize.x, pixelCoords0.y + tileSize.y)
    const latLonCoords0 = map.wrapLatLng(map.unproject(pixelCoords0, coords.z))
    const latLonCoords1 = map.wrapLatLng(map.unproject(pixelCoords1, coords.z))
    return L.latLngBounds(latLonCoords0, latLonCoords1)
}

const TiledFeatureLayer = L.GridLayer.extend({
    async initialize(options) {
        // this.geojsonLayer = options.geojsonLayer
        this.activity = options.activity
        this.layerName = options.layerName
        this.service = options.service
        
        // register event callbacks
        this.on('tileload', (event) => { this.onTileLoad(event) })
        this.on('tileunload', (event) => { this.onTileUnload(event) })

        this.loadedTiles = new Set()
        // this.scheduledForUnload = 
    },

    onAdd (map) {
        this.map = map
        // be notified when zoom starts
        // keep a ref on bound objects to be able to remove them later
        // this.zoomStartCallback = this.onZoomStart.bind(this)
        // this.zoomEndCallback = this.onZoomEnd.bind(this)
        // map.on('zoomstart', this.zoomStartCallback)
        // map.on('zoomend', this.zoomEndCallback)

        L.GridLayer.prototype.onAdd.call(this, map)
    },

    onRemove (map) {
        L.GridLayer.prototype.onRemove.call(this, map)
        
        this.map = null
    },

    createTile (coords, done) {
        const tile = document.createElement('div')

        let skipTile = false
        
        // check we need to load the tile
        // we don't have to load it when a tile at an upper zoom level
        // encompassing the tile is already loaded
        const triplet = {
            x: coords.x,
            y: coords.y,
            z: coords.z
        }

        while (triplet.z > 1) {
            const tilekey = (triplet.x * 536870912) + (triplet.y * 32) + triplet.z
            if (this.loadedTiles.has(tilekey)) {
                skipTile = true
                break
            }

            triplet.x = Math.ceil(triplet.x / 2)
            triplet.y = Math.ceil(triplet.y / 2)
            triplet.z -= 1
        }

        if (!skipTile) {
            // tile.style.outline = '1px solid red'
            
            const tileSize = this.getTileSize()
            const pixelCoords0 = L.point(coords.x * tileSize.x, coords.y * tileSize.y)
            const pixelCoords1 = L.point(pixelCoords0.x + tileSize.x, pixelCoords0.y + tileSize.y)
            const latLonCoords0 = this.map.wrapLatLng(this.map.unproject(pixelCoords0, coords.z))
            const latLonCoords1 = this.map.wrapLatLng(this.map.unproject(pixelCoords1, coords.z))

            const reqBBox = [
                Math.min(latLonCoords0.lat, latLonCoords1.lat), Math.min(latLonCoords0.lng, latLonCoords1.lng),
                Math.max(latLonCoords0.lat, latLonCoords1.lat), Math.max(latLonCoords0.lng, latLonCoords1.lng)
            ]

            const query = {
                geometry: {
                    $geoIntersects: {
                        $geometry: {
                            type: 'Polygon',
                            coordinates: [ // BBox as a polygon
                                [[reqBBox[1], reqBBox[0]], [reqBBox[3], reqBBox[0]],
                                 [reqBBox[3], reqBBox[2]], [reqBBox[1], reqBBox[2]], [reqBBox[1], reqBBox[0]]] // Closing point
                            ]
                        }
                    }
                }
            }

            this.service.find({ query }).then(result => {
                tile.geojson = result
                // tile.innerHTML = `coords: ${coords.x} ${coords.y} ${coords.z} ${result.features.length} features in tile ${tileSize.y} x ${tileSize.x}`
                done(null, tile)
            }).catch(err => {
                done(err, tile)
                throw err
            })
        } else {
            // tile.style.outline = '1px solid green'
            // tile.innerHTML = 'skipped!'
            setTimeout(() => { done(null, tile) }, 100)
        }
        
        return tile
    },

    onTileLoad (event) {
        const geojson = event.tile.geojson
        if (!geojson) return

        const triplet = {
            x: event.coords.x,
            y: event.coords.y,
            z: event.coords.z
        }
        const tilekey = (triplet.x * 536870912) + (triplet.y * 32) + triplet.z
        this.loadedTiles.add(tilekey)

        this.activity.updateLayer(this.layerName, geojson)
    },

    onTileUnload (event) {
        const visible = this.map.getBounds()
        const bounds = tileToBounds(this.map, event.coords, this.getTileSize()) 
        if (visible.intersects(bounds))
            return

        const geojson = event.tile.geojson
        if (!geojson) return

        const triplet = {
            x: event.coords.x,
            y: event.coords.y,
            z: event.coords.z
        }
        const tileKey = (triplet.x * 536870912) + (triplet.y * 32) + triplet.z
        this.loadedTiles.delete(tileKey)
        
        this.activity.updateLayer(this.layerName, geojson, true)
    },

    onZoomStart (event) {
        
    },

    onZoomEnd (event) {
        
    }
})

export { TiledFeatureLayer }
