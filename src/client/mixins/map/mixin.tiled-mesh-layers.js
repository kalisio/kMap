import _ from 'lodash'
import L from 'leaflet'
import chroma from 'chroma-js'
import * as PIXI from 'pixi.js'
import 'leaflet-pixi-overlay'

import { OpenDAPGridSource } from '../../../common/opendap-grid-source.js'
import { vtxShaderSrc, frgShaderSrc, ColorMapHook, buildPixiMeshFromGrid } from '../../leaflet/pixi-utils.js'

// TODO
// figure out initialZoom stuff
// check why when i store options it screw leaflet up

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
        this.layerUniforms = new PIXI.UniformGroup({ alpha: options.opacity, zoomLevel: 1.0 /*, cutValue: 295.0*/ })
        this.pixiState = new PIXI.State()
        this.pixiState.culling = true
        this.pixiState.blendMode = PIXI.BLEND_MODES.SCREEN
        this.program = new PIXI.Program(vtxShaderSrc, frgShaderSrc, 'opendap-mesh-render')

        const self = this

        // register event callbacks
        this.on('tileload', function (event) { self.onTileLoad(event) })
        this.on('tileunload', function (event) { self.onTileUnload(event) })

        // instanciate mesh source
        this.gridSource = new OpenDAPGridSource()
        this.gridSource.setup(options.opendap).then(() => { self.onDataChanged() })
    },

    onAdd (map) {
        this.map = map
        map.addLayer(this.pixiLayer)

        // be notified when zoom starts
        const self = this
        map.on('zoomstart', function (event) { self.onZoomStart(event) })
        map.on('zoomend', function (event) { self.onZoomEnd(event) })

        L.GridLayer.prototype.onAdd.call(this, map)
    },

    onRemove (map) {
        map.removeLayer(this.pixiLayer)

        L.GridLayer.prototype.onRemove.call(this, map)
        this.map = null
    },

    createTile (coords, done) {
        const tileSize = this.getTileSize()
        const pixelCoords0 = L.point(coords.x * tileSize.x, coords.y * tileSize.y)
        const pixelCoords1 = L.point(pixelCoords0.x + tileSize.x, pixelCoords0.y + tileSize.y)
        const latLonCoords0 = this.map.wrapLatLng(this.map.unproject(pixelCoords0, coords.z))
        const latLonCoords1 = this.map.wrapLatLng(this.map.unproject(pixelCoords1, coords.z))

        const tile = document.createElement('div');

        const reqBBox = [
            Math.min(latLonCoords0.lat, latLonCoords1.lat), Math.min(latLonCoords0.lng, latLonCoords1.lng),
            Math.max(latLonCoords0.lat, latLonCoords1.lat), Math.max(latLonCoords0.lng, latLonCoords1.lng)
        ]
        const resolution = [(reqBBox[2] - reqBBox[0]) / (tileSize.y - 1), (reqBBox[3] - reqBBox[1]) / (tileSize.x - 1)]
        this.gridSource.fetch(reqBBox, resolution).then(grid => {
            if (grid) {
                const colormapper = new ColorMapHook(this.colorMap, 'color')
                const geometry = buildPixiMeshFromGrid(grid, [ colormapper ])

                const dataBBox = grid.getBBox()
                const offsetScale = [ dataBBox[0], dataBBox[1], dataBBox[2] - dataBBox[0], dataBBox[3] - dataBBox[1] ]
                const uniforms = {
                    latLonBounds: Float32Array.from(reqBBox),
                    offsetScale: Float32Array.from(offsetScale),
                    layerUniforms: this.layerUniforms
                }
                const shader = new PIXI.Shader(this.program, uniforms)
                const mesh = new PIXI.Mesh(geometry, shader, this.pixiState, PIXI.DRAW_MODES.TRIANGLE_STRIP)
                if (mesh)
                    mesh.zoomLevel = coords.z
                tile.mesh = mesh

                /*
                const dims = grid.getDimensions()
                const res  = grid.getResolution()
                tile.innerHTML = `
req res: ${resolution[0].toPrecision(4)} ${resolution[1].toPrecision(4)}</br>
got res: ${res[0].toPrecision(4)} ${res[1].toPrecision(4)}</br>
${dims[0]} x ${dims[1]} vertex for ${tileSize.y} x ${tileSize.x} pixels`
                tile.style.outline = '1px solid red';
                */
            }

            done(null, tile)
        })

        return tile
    },

    /*
      async setCurrentTime (datetime) {

      },
    */

    onTileLoad (event) {
        if (event.tile.mesh) {
            this.pixiRoot.addChild(event.tile.mesh)
            this.pixiLayer.redraw()
        }
    },

    onTileUnload (event) {
        if (event.tile.mesh) {
            this.pixiRoot.removeChild(event.tile.mesh)
            this.pixiLayer.redraw()
            event.tile.mesh = null
        }
    },

    onZoomStart (event) {
        // hide meshes from current zoom level
        // this prevents visual weirdness when zooming where
        // zoom level 'n' tiles are still visible
        // and zoom level 'n+1' are being loaded on top of them
        // when alpha blending is used, this is annoying
        const zoomLevel = this.map.getZoom()
        for (const mesh of this.pixiRoot.children) {
            if (mesh.zoomLevel == zoomLevel)
                mesh.visible = false
        }
    },

    onZoomEnd (event) {
        // show meshes at current zoom level
        // this restores visibility for meshes that may have been hidden
        // on zoomstart event
        // this is important when quickly zoomin in and out
        // because some meshes may not have been evicted yet
        const zoomLevel = this.map.getZoom()
        for (const mesh of this.pixiRoot.children) {
            if (mesh.zoomLevel == zoomLevel)
                mesh.visible = true
        }
    },

    onDataChanged () {
        const bbox = this.gridSource.getBBox()
        if (bbox) {
            // allow grid layer to only request tiles located in those bounds
            const c1 = L.latLng(bbox[0], bbox[1])
            const c2 = L.latLng(bbox[2], bbox[3])
            this.options.bounds = L.latLngBounds(c1, c2)
        }

        const bounds = this.gridSource.getDataBounds()
        this.colorMap = chroma.scale(this.options.chromajs.scale).domain(
            this.options.chromajs.invertScale ? bounds.reverse() : bounds)

        // clear tiles and request again
        this.redraw()
    },

    renderPixiLayer (utils) {
        this.layerUniforms.uniforms.zoomLevel = this.pixiLayer._initialZoom
        const renderer = utils.getRenderer()
        renderer.render(this.pixiRoot)
    },
})

export default {
    methods: {
        createLeafletTiledMeshLayer (options) {
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
