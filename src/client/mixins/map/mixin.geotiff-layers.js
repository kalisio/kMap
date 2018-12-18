import _ from 'lodash'
import L from 'leaflet'
import parseGeoraster from 'georaster'
import chroma from 'chroma-js'
import moment from 'moment'

let GeotiffLayer = L.GridLayer.extend({

  initialize (options) {
    if (!options.keepBuffer) options.keepBuffer = 25
    if (!options.resolution) options.resolution = Math.pow(2, 5)
    if (options.updateWhenZooming === undefined) options.updateWhenZooming = false

    this.url = options.url
    this.currentTime = moment(0)
    this.interval = options.interval
    this.colorMap = null
    this.colorMapOptions = {
      scale: options.scale ? options.scale : null,
      domain: options.domain ? options.domain : null,
      classes: options.classes ? options.classes : null
    }

    // Unpacking values for use later. We do this in order to increase speed.
    this._noDataValue = null
    this._pixelWidth = 1
    this._pixelHeight = 1
    this._rasters = []
    this._xmin = 0
    this._ymin = 0
    this._xmax = 0
    this._ymax = 0
    this._bounds = [[0, 0], [0, 0]]
    options.bounds = this._bounds
    L.setOptions(this, options)

    // caching the constant tile size, so we don't recalculate everytime we reate a new tile
    let tileSize = this.getTileSize()
    this._tileHeight = tileSize.y
    this._tileWidth = tileSize.x
  },

  setGeoRaster (raster) {
    let scale = this.colorMapOptions.scale ? this.colorMapOptions.scale : ''
    let domain = this.colorMapOptions.domain ? this.colorMapOptions.domain : [raster.mins[0], raster.maxs[0]]
    let classes = this.colorMapOptions.classes ? this.colorMapOptions.classes : []
    this.colorMap = chroma.scale(scale).classes(classes).domain(domain)

    // Unpacking values for use later. We do this in order to increase speed.
    this._noDataValue = raster.noDataValue
    this._pixelWidth = raster.pixelWidth
    this._pixelHeight = raster.pixelHeight
    this._rasters = raster.values
    this._xmin = raster.xmin
    this._ymin = raster.ymin
    this._xmax = raster.xmax
    this._ymax = raster.ymax

    let southWest = L.latLng(raster.ymin, raster.xmin)
    let northEast = L.latLng(raster.ymax, raster.xmax)
    this._bounds = L.latLngBounds(southWest, northEast)
    L.setOptions(this, { bounds: this._bounds })

    // caching the constant tile size, so we don't recalculate everytime we reate a new tile
    let tileSize = this.getTileSize()
    this._tileHeight = tileSize.y
    this._tileWidth = tileSize.x

    this.redraw()
  },

  async setCurrentTime (datetime) {
    const timestamp = datetime.valueOf()
    let nearestTime = moment(Math.floor(timestamp / this.interval) * this.interval)
    if (this.currentTime !== nearestTime) {
      // Store the time
      this.currentTime = nearestTime
      // Compute the url
      let compiledUrl = _.template(this.url)
      const url = compiledUrl({
        Y: this.currentTime.year(),
        M: this.currentTime.month(),
        D: this.currentTime.day(),
        hh: this.currentTime.hours().toString().padStart(2, '0'),
        mm: this.currentTime.minutes().toString().padStart(2, '0')
      })
      // Get the geotiff
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const georaster = await parseGeoraster(arrayBuffer)
      // Update the data
      this.setGeoRaster(georaster)
    }
  },

  createTile (coords) {
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

      // Copy options
      const colorMap = _.get(options, 'variables[0].chromajs', null)
      if (colorMap) Object.assign(leafletOptions, colorMap)

      Object.assign(leafletOptions, { resolution: 128 })
      this.geotiffLayer = new GeotiffLayer(leafletOptions)
      return this.geotiffLayer
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletGeotiffLayer)
  }
}

export default geotiffLayersMixin
