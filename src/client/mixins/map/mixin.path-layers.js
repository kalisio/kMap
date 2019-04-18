import logger from 'loglevel'
import _ from 'lodash'
import L, { point } from 'leaflet'
import * as PIXI from 'pixi.js'
import 'leaflet-pixi-overlay'


function distance (point1, point2) {
  let v = { 
    x: point2.x - point1.x,
    y: point2.y - point1.y
  }
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

class PathRenderer {
  constructor () {
    this.paths = []
    this.redraw = false
    this.currentZoom = undefined
    this.pixiContainer = null
  }

  initialize (options) {
    Object.assign(this, options)
    // Create an empty container
    this.pixiContainer = new PIXI.Container()
    // Create the overlay layer
    return L.pixiOverlay(utils => this.render(utils), this.pixiContainer, {
      autoPreventDefault: false
    })
  }

  setPaths (paths) {
    this.pixiContainer.removeChildren()
    this.paths = paths
  }

  createSolidTexture (color, weight) {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = weight
    // use canvas2d API to create the solid texture
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return PIXI.Texture.from(canvas)
  }

  createGradientTexture (gradient, weight) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = weight
    // use canvas2d API to create the gradient texture
    const ctx = canvas.getContext('2d')
    const grd = ctx.createLinearGradient(0, 0, canvas.width, 1)
    for (let i = 0; i < gradient.length; i++) {
      grd.addColorStop(gradient[i].offset, gradient[i].color)
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return PIXI.Texture.from(canvas);
  }

  render (utils) {
    const zoom = utils.getMap().getZoom()
    if (this.pixiContainer.children.length !== this.paths.length || this.currentZoom !== zoom) {
      let renderer = utils.getRenderer()
      for (let i=0; i < this.paths.length; i++) {
        const path = this.paths[i]
        const points = []
        let distances = []
        let length = 0
        for (let j=0; j < path.coords.length; j++) {
          const coord = path.coords[j]
          const point = utils.latLngToLayerPoint([coord[1], coord[0]])
          if (j!==0) length += distance(point, points[points.length-1])
          distances.push(length) 
          points.push(point)
        }
        let texture = null
        // FIXME: how to ensure a pixel constant size when zooming ?
        let weight = 512 * path.weight / Math.pow(2, zoom)
        if (Array.isArray(path.gradient)) {
          // compute the gradient
          let gradient = []
          for (let j=0; j < path.coords.length; j++) {
            gradient.push({ offset: distances[j] / length, color: path.gradient[j] })
          }
          texture = this.createGradientTexture(gradient, weight)
        } else {
          texture = this.createSolidTexture(path.gradient, weight)
        }
        this.pixiContainer.addChild(new PIXI.mesh.Rope(texture, points))
        /* 
        Alternative method using Graphics

        const graphicsPath = new PIXI.Graphics()
        graphicsPath.lineTextureStyle(10, this.createGradient())
        graphicsPath.lineStyle(1 / scale, 0x3388ff, 1)
        for (let j=0; j < path.length; j++) {
          const vertex = path[j]
          let pos = utils.latLngToLayerPoint([vertex[1], vertex[0]])
          if (j===0) graphicsPath.moveTo(pos.x, pos.y)
          else graphicsPath.lineTo(pos.x, pos.y)
        }
        this.pixiContainer.addChild(graphicsPath)
        */
      }
      renderer.render(this.pixiContainer)
      this.currentZoom = zoom
    }
  }
}

let PathLayer = L.Layer.extend({

  initialize (options) {
    Object.assign(this, options)
    this.pathRenderer = new PathRenderer()
    this.pathOverlay = this.pathRenderer.initialize(Object.assign(options))
    this.pathBounds = null
    L.setOptions(this, options || {})    
  },

  onAdd (map) {
    map.addLayer(this.pathOverlay)
  },

  onRemove (map) {
    map.removeLayer(this.pathOverlay)
  },

  updatePaths (features) {
    let paths = []
    this.pathBounds = new L.LatLngBounds()
    _.forEach(features, feature => {
      if (feature.geometry && feature.geometry.type && feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates
        if (coords) {
          // Updated the bounds
          for (let i=0; i< coords.length; ++i) {
            const coord = coords[i]
            this.pathBounds.extend([coord[1], coord[0]])
          }
          let gradient = _.get(feature, 'properties.gradient', _.get(feature, 'properties.stroke', '#FFFFFF'))
          let weight = _.get(feature, 'properties.weight', '8')
          paths.push({ coords, gradient, weight })
        }
      }
    })
    if (paths.length) {
      this.pathRenderer.setPaths(paths)
      this.pathOverlay.redraw()
      this.fire('data', paths)
    }
  },

  getBounds () {
    return this.pathBounds
  }
})

let pathLayersMixin = {
  methods: {
    async createLeafletPathLayer (options) {
      let leafletOptions = options.leaflet || options
      
      // Check for valid type
      if (leafletOptions.type !== 'path') return
      Object.assign(leafletOptions)
      this.pathLayer = new PathLayer(leafletOptions)
      return this.pathLayer
    },
    updatePaths (geoJson) {
      let type = _.get(geoJson, 'type', null)
      switch (type) {
        case 'Feature':
          this.pathLayer.updatePaths([geoJson])
          break;
        case 'FeatureCollection':
          this.pathLayer.updatePaths(geoJson.features)
          break;
        default:
          logger.warn('invalid GeoJson object')
      }
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletPathLayer)
  }
}

export default pathLayersMixin
