import L from 'leaflet'
import parseGeoraster from 'georaster'
import chroma from 'chroma-js'

let GeotiffLayer = L.GridLayer.extend({

  initialize: function (options) {
    try {
      if (!options.keepBuffer) options.keepBuffer = 25
      if (!options.resolution) options.resolution = Math.pow(2, 5)
      if (options.updateWhenZooming === undefined) options.updateWhenZooming = false

      let georaster = options.georaster
      this.georaster = georaster

      let domain = [georaster.mins[0], georaster.maxs[0]]
      let classes = []
      this.colorMap = chroma.scale().domain(domain)
      if (options.scale) {
        if (options.domain) domain = options.domain
        if (options.classes) classes = options.classes
        this.colorMap = chroma.scale(options.scale).classes(classes).domain(domain)
      }

      // Unpacking values for use later. We do this in order to increase speed.
      this._noDataValue = georaster.noDataValue
      this._pixelWidth = georaster.pixelWidth
      this._pixelHeight = georaster.pixelHeight
      this._rasters = georaster.values
      this._tiff_width = georaster.width
      this._xmin = georaster.xmin
      this._ymin = georaster.ymin
      this._xmax = georaster.xmax
      this._ymax = georaster.ymax

      let southWest = L.latLng(georaster.ymin, georaster.xmin)
      let northEast = L.latLng(georaster.ymax, georaster.xmax)
      this._bounds = L.latLngBounds(southWest, northEast)
      options.bounds = this._bounds
      L.setOptions(this, options)

      // caching the constant tile size, so we don't recalculate everytime we reate a new tile
      let tileSize = this.getTileSize()
      this._tileHeight = tileSize.y
      this._tileWidth = tileSize.x
    } catch (error) {
      console.error('ERROR initializing GeoTIFFLayer', error)
    }
  },

  createTile: function (coords) {
    // Unpacking values for use later. We do this in order to increase speed.
    let noDataValue = this._noDataValue
    let pixelWidth = this._pixelWidth
    let pixelHeight = this._pixelHeight
    let rasters = this._rasters
    let colorMap = this.colorMap
    let xmin = this._xmin
    let ymin = this._ymin
    let xmax = this._xmax
    let ymax = this._ymax

    // create a <canvas> element for drawing
    let tile = L.DomUtil.create('canvas', 'leaflet-tile')
    tile.height = this._tileHeight
    tile.width = this._tileWidth

    // get a canvas context and draw something on it using coords.x, coords.y and coords.z
    let context = tile.getContext('2d')

    let bounds = this._tileCoordsToBounds(coords)
    let xminOfTile = bounds.getWest()
    let xmaxOfTile = bounds.getEast()
    let yminOfTile = bounds.getSouth()
    let ymaxOfTile = bounds.getNorth()

    let resolution = this.options.resolution

    let rasterPixelsAcross = Math.ceil((xmaxOfTile - xminOfTile) / pixelWidth)
    let rasterPixelsDown = Math.ceil((ymaxOfTile - yminOfTile) / pixelHeight)
    let nbOfRectanglesAcross = Math.min(resolution, rasterPixelsAcross)
    let nbOfRectanglesDown = Math.min(resolution, rasterPixelsDown)

    let heightOfRectInPixels = this._tileHeight / nbOfRectanglesDown
    let heightOfRectInPixelsInt = Math.ceil(heightOfRectInPixels)
    let widthOfRectInPixels = this._tileWidth / nbOfRectanglesAcross
    let widthOfRectInPixelsInt = Math.ceil(widthOfRectInPixels)

    let map = this._map
    let tileSize = this.getTileSize()
    let tileNwPoint = coords.scaleBy(tileSize)

    for (let h = 0; h < nbOfRectanglesDown; h++) {
      let yCenterInMapPixels = tileNwPoint.y + (h + 0.5) * heightOfRectInPixels
      let latWestPoint = L.point(tileNwPoint.x, yCenterInMapPixels)
      let latWest = map.unproject(latWestPoint, coords.z)
      let lat = latWest.lat

      if (lat > ymin && lat < ymax) {
        let yInTilePixels = Math.round(h * heightOfRectInPixels)
        let yInRasterPixels = Math.floor((ymax - lat) / pixelHeight)

        for (let w = 0; w < nbOfRectanglesAcross; w++) {
          let latLngPoint = L.point(tileNwPoint.x + (w + 0.5) * widthOfRectInPixels, yCenterInMapPixels)
          let latLng = map.unproject(latLngPoint, coords.z)
          let lng = latLng.lng

          if (lng > xmin && lng < xmax) {
            let xInRasterPixels = Math.floor((lng - xmin) / pixelWidth)
            let values = rasters.map(raster => raster[yInRasterPixels][xInRasterPixels])

            let color = null
            switch (values.length) {
              case 1:
                const value = values[0]
                if (value !== noDataValue) color = colorMap(values[0])
                break
              case 2:
              // FIXME
                break
              case 3:
                color = 'rgb(' + values[0] + ',' + values[1] + ',' + values[2] + ')'
                break
              case 4:
                color = 'rgba(' + values[0] + ',' + values[1] + ',' + values[2] + ',' + values[3] + ')'
                break
              default:
              // FIXME
            }

            if (color) {
              context.fillStyle = color
              context.fillRect(Math.round(w * widthOfRectInPixels), yInTilePixels, widthOfRectInPixelsInt, heightOfRectInPixelsInt)
            }
          }
        }
      }
    }
    return tile
  },

  // method from https://github.com/Leaflet/Leaflet/blob/bb1d94ac7f2716852213dd11563d89855f8d6bb1/src/layer/ImageOverlay.js
  getBounds: function () {
    return this._bounds
  }
})

let geotiffLayersMixin = {
  methods: {
    async createLeafletGeotiffLayer (options) {
      let leafletOptions = options.leaflet || options
      // Check for valid type
      if (leafletOptions.type !== 'geotiff') return

      const response = await fetch(leafletOptions.url)
      const arrayBuffer = await response.arrayBuffer()
      const georaster = await parseGeoraster(arrayBuffer)

      // Copy options
      const colorMap = _.get(options, 'variables[0].chromajs', null)
      if (colorMap) Object.assign(leafletOptions, colorMap)
     
      Object.assign(leafletOptions, { georaster: georaster, resolution: 128 })
      return new GeotiffLayer(leafletOptions)
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletGeotiffLayer)
  }
}

export default geotiffLayersMixin
