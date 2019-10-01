import _ from 'lodash'
import L from 'leaflet'
import chroma from 'chroma-js'
import * as PIXI from 'pixi.js'
import 'leaflet-pixi-overlay'

import { OPeNDAPMesh } from '../../leaflet/opendap-mesh'

// TODO
// build colormap based on options
// figure out initialZoom stuff
// use null instead of undefined when no result

const TiledMeshLayer = L.GridLayer.extend({
    initialize (options) {
        // keep color scale options
        this.options.chromajs = options.chromajs

        // setup pixi objects
        const pixiLayerOptions = {
            destroyInteractionManager: true,
            shouldRedrawOnMove: function() { return true }
        }
        this.pixiRoot = new PIXI.Container()
        this.pixiLayer = L.pixiOverlay(utils => this.renderPixiLayer(utils), this.pixiRoot, pixiLayerOptions)
        this.layerUniforms = new PIXI.UniformGroup({ alpha: options.opacity, zoomLevel: 1.0 })

        const self = this

        // register event callbacks
        this.on('tileload', function (event) { self.onTileLoad(event) })
        this.on('tileunload', function (event) { self.onTileUnload(event) })

        // instanciate mesh source
        this.meshSource = new OPeNDAPMesh()
        this.meshSource.initialize(options, function() { self.onDataChanged() })
    },

    onAdd (map) {
        this.map = map
        map.addLayer(this.pixiLayer)

        // be notified when zoom starts
        const self = this
        map.on('zoomstart', function (event) { self.onZoomStart(event) })

        L.GridLayer.prototype.onAdd.call(this, map)
    },

    onRemove (map) {
        map.removeLayer(this.pixiLayer)

        L.GridLayer.prototype.onRemove.call(this, map)
        this.map = undefined
    },

    createTile (coords, done) {
        const tileSize = this.getTileSize()
        const pixelCoords0 = L.point(coords.x * tileSize.x, coords.y * tileSize.y)
        const pixelCoords1 = L.point(pixelCoords0.x + tileSize.x, pixelCoords0.y + tileSize.y)
        const latLonCoords0 = this.map.wrapLatLng(this.map.unproject(pixelCoords0, coords.z))
        const latLonCoords1 = this.map.wrapLatLng(this.map.unproject(pixelCoords1, coords.z))

        var tile = document.createElement('div');
        /*
          tile.innerHTML = [latLonCoords0.lat, latLonCoords0.lng].join(', ');
          tile.style.outline = '1px solid red';
        */

        const minLat = Math.min(latLonCoords0.lat, latLonCoords1.lat)
        const maxLat = Math.max(latLonCoords0.lat, latLonCoords1.lat)
        const minLon = Math.min(latLonCoords0.lng, latLonCoords1.lng)
        const maxLon = Math.max(latLonCoords0.lng, latLonCoords1.lng)

        const options = {
            bounds: [minLat, minLon, maxLat, maxLon]
        }
        this.meshSource.fetchMesh(options, this.layerUniforms).then(function (mesh) {
            tile.mesh = mesh
            done(null, tile)
        })

        return tile
    },

    /*
    async setCurrentTime (datetime) {
       
    },
    */

    onTileLoad (event) {
        if (event.tile.mesh !== undefined) {
            this.pixiRoot.addChild(event.tile.mesh)
            this.pixiLayer.redraw()
        }
    },

    onTileUnload (event) {
        if (event.tile.mesh !== undefined) {
            this.pixiRoot.removeChild(event.tile.mesh)
            this.pixiLayer.redraw()
            event.tile.mesh = undefined
        }
    },

    onZoomStart (event) {
        // hide meshes from current zoom level
        // this prevents visual weirdness when zooming where
        // zoom level 'n' tiles are still visible
        // and zoom level 'n+1' are being loaded on top of them
        // when alpha blending is used, this is annoying
        for (const mesh of this.pixiRoot.children) {
            mesh.visible = false
        }
    },

    onDataChanged () {
        if (this.meshSource.hasSpatialBounds()) {
            // allow grid layer to only request tiles located in those bounds
            const minMaxLat = this.meshSource.minMaxLat
            const minMaxLon = this.meshSource.minMaxLon
            const c1 = L.latLng(minMaxLat[0], minMaxLon[0])
            const c2 = L.latLng(minMaxLat[1], minMaxLon[1])
            this.options.bounds = L.latLngBounds(c1, c2)
        }

        // TODO: create color map based on options
        this.colorMap = chroma.scale(this.options.chromajs.scale).domain(this.meshSource.minMaxVal)
        this.meshSource.setColorMap(this.colorMap)

        // clear tiles and request again
        this.redraw()
    },

    renderPixiLayer (utils) {
        this.layerUniforms.uniforms.zoomLevel = this.pixiLayer._initialZoom
        let renderer = utils.getRenderer()
        renderer.render(this.pixiRoot)
    },
})

export default {
  methods: {
      async createLeafletTiledMeshLayer (options) {
          const leafletOptions = options.leaflet || options

          // Check for valid type
          if (leafletOptions.type !== 'tiledMeshLayer') return

          // Copy options
          const colorMap = _.get(options, 'variables[0].chromajs', null)
          if (colorMap) Object.assign(leafletOptions, { chromajs: colorMap })

          this.tiledMeshLayer = new TiledMeshLayer(leafletOptions)
          return this.tiledMeshLayer
    }
  },
  created () {
    this.registerLeafletConstructor(this.createLeafletTiledMeshLayer)
  }
}
