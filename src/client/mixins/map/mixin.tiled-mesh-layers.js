import _ from 'lodash'
import L from 'leaflet'
import chroma from 'chroma-js'
import * as PIXI from 'pixi.js'
import 'leaflet-pixi-overlay'
import AbortController from 'abort-controller'

import { makeGridSource } from '../../../common/grid'
import { ColorMapHook, RawValueHook, buildPixiMeshFromGrid, buildColorMapFunction } from '../../pixi-utils'

const vtxShaderSrc = `
  precision mediump float;

  attribute vec2 position;
#if COLORMAPPED_COLOR
  attribute vec4 color;
#elif FILL_COLOR
  uniform vec4 color;
#endif
  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  uniform float zoomLevel;
  uniform vec4 offsetScale;
  // uniform vec2 dataOffsetScale;
  varying vec4 vColor;
  varying vec2 vLatLon;

#if HAS_NODATA
  uniform float nodata;
  varying float vValid;
#endif

/*#if CUT_OVER || CUT_UNDER*/
  attribute float value;
  varying float vValue;
/*#endif*/

  vec2 LatLonToWebMercator(vec3 latLonZoom) {
    const float d = 3.14159265359 / 180.0;
    const float maxLat = 85.0511287798;     // max lat using Web Mercator, used by EPSG:3857 CRS
    const float R = 6378137.0;              // earth radius

    // project
    // float lat = max(min(maxLat, latLonZoom[0]), -maxLat);
    float lat = clamp(latLonZoom[0], -maxLat, maxLat);
    float sla = sin(lat * d);
    vec2 point = vec2(R * latLonZoom[1] * d, R * log((1.0 + sla) / (1.0 - sla)) / 2.0);

    // scale
    float scale = 256.0 * pow(2.0, latLonZoom[2]);

    // transform
    const float s = 0.5 / (3.14159265359 * R);
    const vec4 abcd = vec4(s, 0.5, -s, 0.5);

    return scale * ((point * abcd.xz) + abcd.yw);
  }

  void main() {
//#if CUT_OVER || CUT_UNDER
    vValue = value;
    // vValue = offsetScale.x + value * offsetScale.y;
// #endif

#if HAS_NODATA
    vValid = (vValue == nodata ? 0.0 : 1.0);
#endif

    // vColor = color;
    vColor = ColorMap(vValue);
    vLatLon = offsetScale.xy + position.xy * offsetScale.zw;
    // vLatLon = position.xy;
    vec2 projected = LatLonToWebMercator(vec3(vLatLon, zoomLevel));
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(projected, 1.0)).xy, 0.0, 1.0);
  }`

const frgShaderSrc = `
  precision mediump float;

  varying vec4 vColor;
  varying vec2 vLatLon;
  uniform float alpha;
  uniform vec4 latLonBounds;

#if CUT_OVER || CUT_UNDER
  varying float vValue;
#if CUT_OVER
  uniform float cutOver;
#endif
#if CUT_UNDER
  uniform float cutUnder;
#endif
#endif

#if HAS_NODATA
  varying float vValid;
#endif

  void main() {
    bvec4 outside = bvec4(lessThan(vLatLon, latLonBounds.xy), greaterThan(vLatLon, latLonBounds.zw));
    if (any(outside))
      discard;

#if HAS_NODATA
    if (vValid != 1.0)
      discard;
#endif

#if CUT_OVER
    if (vValue > cutOver)
      discard;
#endif

#if CUT_UNDER
    if (vValue < cutUnder)
      discard;
#endif

    gl_FragColor.rgb = vColor.rgb * alpha;
    gl_FragColor.a = alpha;
  }`

// TODO
// figure out initialZoom stuff
// check why when i store options it screw leaflet up

const TiledMeshLayer = L.GridLayer.extend({
    initialize (options) {
        // keep color scale options
        this.options.chromajs = options.chromajs
        // keep rendering options
        this.options.render = {
            cutOver: options.cutOver,
            cutUnder: options.cutUnder,
            fillColor: options.fillColor
        }
        // keep debug options
        this.options.debug = {
            showTileInfos: options.showTileInfos,
            meshAsPoints: options.meshAsPoints,
            showShader: options.showShader
        }

        this.resolutionScale = _.get(options, 'resolutionScale', [1.0, 1.0])

        // setup pixi objects
        this.pixiRoot = new PIXI.Container()
        this.pixiLayer = L.pixiOverlay(
            utils => this.renderPixiLayer(utils),
            this.pixiRoot,
            { destroyInteractionManager: true, shouldRedrawOnMove: function () { return true } })
        this.layerUniforms = new PIXI.UniformGroup({ alpha: options.opacity, zoomLevel: 1.0 })
        this.pixiState = new PIXI.State()
        this.pixiState.culling = true
        this.pixiState.blendMode = PIXI.BLEND_MODES.SCREEN

        // setup layer global uniforms (as opposed to tile specific uniforms)
        this.cutValueUniform = null
        if (options.cutOver) {
            this.layerUniforms.uniforms.cutOver = 0.0
            if (typeof options.cutOver === 'string') {
                this.cutValueUniform = 'cutOver'
            } else {
                this.layerUniforms.uniforms.cutOver = options.cutOver
            }
        }
        if (options.cutUnder) {
            this.layerUniforms.uniforms.cutUnder = 0.0
            if (typeof options.cutUnder === 'string') {
                this.cutValueUniform = 'cutUnder'
            } else {
                this.layerUniforms.uniforms.cutUnder = options.cutUnder
            }
        }
        if (options.fillColor) {
            this.layerUniforms.uniforms.color = Float32Array.from(options.fillColor)
        }

        // register event callbacks
        this.on('tileload', (event) => { this.onTileLoad(event) })
        this.on('tileunload', (event) => { this.onTileUnload(event) })

        // instanciate grid source
        const [gridSource, gridOptions] = makeGridSource(options)
        this.gridSource = gridSource
        this.gridSource.setup(gridOptions).then(() => { this.onDataChanged() })
    },

    onAdd (map) {
        this.map = map
        map.addLayer(this.pixiLayer)

        // be notified when zoom starts
        // keep a ref on bound objects to be able to remove them later
        this.zoomStartCallback = this.onZoomStart.bind(this)
        this.zoomEndCallback = this.onZoomEnd.bind(this)
        map.on('zoomstart', this.zoomStartCallback)
        map.on('zoomend', this.zoomEndCallback)

        L.GridLayer.prototype.onAdd.call(this, map)
    },

    onRemove (map) {
        // remove map listeners
        map.off('zoomstart', this.zoomStartCallback)
        map.off('zoomend', this.zoomEndCallback)
        this.zoomStartCallback = null
        this.zoomEndCallback = null

        map.removeLayer(this.pixiLayer)
        this.map = null

        L.GridLayer.prototype.onRemove.call(this, map)
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
        const resolution = [
            this.resolutionScale[0] * ((reqBBox[2] - reqBBox[0]) / (tileSize.y - 1)),
            this.resolutionScale[1] * ((reqBBox[3] - reqBBox[1]) / (tileSize.x - 1))
        ]
        tile.fetchController = new AbortController()
        this.gridSource.fetch(tile.fetchController.signal, reqBBox, resolution)
            .then(grid => {
                // fetch ended, can't abort anymore
                tile.fetchController = null
                if (grid && grid.hasData()) {
                    // build mesh
                    const raw = new RawValueHook('value')
                    const geometry = buildPixiMeshFromGrid(grid, [ raw ])

                    // compute tile specific uniforms
                    const dataBBox = grid.getBBox()
                    const offsetScale = [
                        dataBBox[0], dataBBox[1],
                        dataBBox[2] - dataBBox[0], dataBBox[3] - dataBBox[1]
                    ]
                    const uniforms = {
                        latLonBounds: Float32Array.from(reqBBox),
                        offsetScale: Float32Array.from(offsetScale),
                        layerUniforms: this.layerUniforms
                    }
                    if (grid.nodata !== undefined)
                        uniforms.nodata = grid.nodata

                    const shader = new PIXI.Shader(this.program, uniforms)
                    const mode = this.options.debug.meshAsPoints ? PIXI.DRAW_MODES.POINTS : PIXI.DRAW_MODES.TRIANGLE_STRIP
                    tile.mesh = new PIXI.Mesh(geometry, shader, this.pixiState, mode)
                }

                if (grid && this.options.debug.showTileInfos) {
                    const dims = grid.getDimensions()
                    const res  = grid.getResolution()
                    tile.innerHTML = `
                      req res: ${resolution[0].toPrecision(4)} ${resolution[1].toPrecision(4)}</br>
                      got res: ${res[0].toPrecision(4)} ${res[1].toPrecision(4)}</br>
                      ${dims[0]} x ${dims[1]} vertex for ${tileSize.y} x ${tileSize.x} pixels`
                    tile.style.outline = '1px solid red';
                }

                done(null, tile)
            })
            .catch(err => {
                console.log(err)
                done(err, tile)
            })

        return tile
    },

    /*
      async setCurrentTime (datetime) {

      },
    */

    onTileLoad (event) {
        // tile loaded
        const mesh = event.tile.mesh
        if (!mesh)
            return

        mesh.zoomLevel = event.coords.z
        mesh.visible = (mesh.zoomLevel === this.map.getZoom())
        this.pixiRoot.addChild(mesh)
        if (mesh.visible) {
            this.pixiLayer.redraw()
        }
    },

    onTileUnload (event) {
        // tile unloaded
        if (event.tile.fetchController) {
            // fetch controller still present, abort fetching underlying data
            event.tile.fetchController.abort()
            event.tile.fetchController = null
        }
        if (event.tile.mesh) {
            // remove and destroy tile mesh
            this.pixiRoot.removeChild(event.tile.mesh)
            // this.pixiLayer.redraw()
            event.tile.mesh.destroy()
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
        this.pixiLayer.redraw()
    },

    onDataChanged () {
        const bbox = this.gridSource.getBBox()
        if (bbox) {
            // allow grid layer to only request tiles located in those bounds
            const c1 = L.latLng(bbox[0], bbox[1])
            const c2 = L.latLng(bbox[2], bbox[3])
            this.options.bounds = L.latLngBounds(c1, c2)
        }

        // eventually, update color map
        this.updateColorMap()
        // eventually, update shader
        this.updateShader()

        // clear tiles and request again
        this.redraw()
    },

    updateColorMap () {
        // if domain/classes were specified in the layer options
        // then nothing to update if colormap already exists
        const domain = _.get(this.options, 'chromajs.domain', null)
        const classes = _.get(this.options, 'chromajs.classes', null)
        if (domain || classes) {
            if (!this.colorMap) {
                if (domain) {
                    this.colorMap = chroma.scale(this.options.chromajs.scale).domain(
                        this.options.chromajs.invertScale ? domain.reverse() : domain)
                } else {
                    this.colorMap = chroma.scale(this.options.chromajs.scale).classes(
                        this.options.chromajs.invertScale ? classes.reverse() : classes)
                }
            }
        } else {
            // colormap is based on grid source bounds
            const bounds = this.gridSource.getDataBounds()
            if (bounds) {
                this.colorMap = chroma.scale(this.options.chromajs.scale).domain(
                    this.options.chromajs.invertScale ? bounds.reverse() : bounds)
            } else {
                console.error('Grid source has no data bounds, can\'t create color map!')
            }
        }
    },

    updateShader () {
        // build shader code corresponding to enabled options
        let defines = `
#define CUT_OVER  ${this.options.render.cutOver ? '1' : '0'}
#define CUT_UNDER ${this.options.render.cutUnder ? '1': '0'}
#define FILL_COLOR ${this.options.render.fillColor ? '1' : '0'}
#define COLORMAPPED_COLOR ${this.options.render.fillColor ? '0' : '1'}
#define HAS_NODATA ${this.gridSource.supportsNoData() ? '1' : '0'}
`

        let colorMapCode
        const domain = _.get(this.options.chromajs, 'domain')
        const classes = _.get(this.options.chromajs, 'classes')
        if (domain || classes) {
            let options = {}
            if (domain) {
                options.domain = domain
            } else {
                options.classes = classes
            }

            options.invertScale = this.options.chromajs.invertScale
            options.colors = []
            for (const c of this.colorMap.colors())
              options.colors.push(chroma(c).gl())

            colorMapCode = buildColorMapFunction(options)
        }

        const vtxCode = defines + colorMapCode + vtxShaderSrc
        const frgCode = defines + frgShaderSrc
        this.program = new PIXI.Program(vtxCode, frgCode)

        if (this.options.debug.showShader) {
            console.log('Generated vertex shader:')
            console.log(vtxCode)
            console.log('Generated fragment shader:')
            console.log(frgCode)
        }
    },

    renderPixiLayer (utils) {
        this.layerUniforms.uniforms.zoomLevel = this.pixiLayer._initialZoom
        const renderer = utils.getRenderer()
        renderer.render(this.pixiRoot)
    },

    setCutValue (value) {
        if (this.cutValueUniform) {
            this.layerUniforms.uniforms[this.cutValueUniform] = value
            this.pixiLayer.redraw()
        }
    }
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
            // TODO: do not copy option and let factory find what's there
            const opendap = _.get(options, 'opendap', null)
            if (opendap) Object.assign(leafletOptions, { opendap: opendap })
            const wcs = _.get(options, 'wcs', null)
            if (wcs) Object.assign(leafletOptions, { wcs: wcs })
            const geotiff = _.get(options, 'geotiff', null)
            if (geotiff) Object.assign(leafletOptions, { geotiff: geotiff })

            const layer = new TiledMeshLayer(leafletOptions)
            return layer
        },

        setCutValue (value) {
            if (this.currentTiledMeshLayer)
                this.currentTiledMeshLayer.setCutValue(value)
        },

        onShowTiledMeshLayer (layer, engineLayer) {
            if (engineLayer instanceof TiledMeshLayer) {
                this.currentTiledMeshLayer = engineLayer
            }
            /*
            // layer being shown, display slider if 'levels' are present
            if (engineLayer instanceof TiledMeshLayer) {
                const levels = _.get(layer, 'levels')
                if (!levels || !levels.values || _.isEmpty(levels.values))
                    return

                this.setSelectableLevels(layer, levels)
                this.setSelectableLevel(levels.values[0])
            }
            */
        },

        onHideTiledMeshLayer (layer) {
            if (layer === this.currentTiledMeshLayer) {
                this.currentTiledMeshLayer = null
            }
            /*
            // layer being hidden, hide slider if any was required
            this.clearSelectableLevels(layer)
            */
        }
    },

    created () {
        this.registerLeafletConstructor(this.createLeafletTiledMeshLayer)
        this.$on('layer-shown', this.onShowTiledMeshLayer)
        this.$on('layer-hidden', this.onHideTiledMeshLayer)
        // this.$on('selectable-level-changed', this.setCutValue)
    },

  beforeDestroy () {
        this.$off('layer-shown', this.onShowTiledMeshLayer)
        this.$off('layer-hidden', this.onHideTiledMeshLayer)
        // this.$off('selectable-level-changed', this.setCutValue)
    }
}
