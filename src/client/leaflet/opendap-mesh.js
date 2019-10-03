import _ from 'lodash'
import * as PIXI from 'pixi.js'
import * as dap from '../../common/opendap-utils.js'
import { vtxShaderSrc, frgShaderSrc, toHalf } from './pixi-utils.js'

// TODO
// store min/max lat/lon/val somewhere
// store lat/lon steps somewhere
// compute or give actual lat/lon step
// query assumes a regular grid to compute correct indices
// check 'options' has everything we need
// factorize opendap helpers
// factorize triangle strip generation
// assumes arrays are sorted from biggest to smallest lat ..
// assumes arrays are sorted from smallest to biggest lon ..

export class OPeNDAPMesh {
  constructor () {
    this.colormap = null
    this.program = null
    this.onDataChanged = null
  }

  initialize (options, onDataChanged) {
    // make sure options has the required fields
    // 'url' for dataset url
    // 'query' for the variable to query (must be a grid)
    // 'dimensions' values to prefill grid dimensions
    // 'latitude' variable to map to latitude
    // 'longitude' variable to map to longitude

    this.program = new PIXI.Program(vtxShaderSrc, frgShaderSrc, 'opendap-mesh-render')
    this.onDataChanged = onDataChanged
    this.reset(options)
  }

  reset (options) {
    this.usable = false
    this.descriptor = null
    this.indices = null
    this.latCount = 0
    this.latIndex = 0
    this.lonCount = 0
    this.lonIndex = 0
    this.minMaxLat = null
    this.minMaxLon = null
    this.minMaxVal = null
    this.latStep = null
    this.lonStep = null

    this.options = options.opendap

    const self = this
    const onDescriptor = dap.fetchDescriptor(this.options.url)
    onDescriptor.then(descriptor => {
      if (dap.variableIsGrid(descriptor, self.options.query)) {
        if (dap.variableIsArray(descriptor, self.options.latitude)) {
          if (dap.variableIsArray(descriptor, self.options.longitude)) {

            self.latIndex = dap.getGridDimensionIndex(descriptor, self.options.query, self.options.latitude)
            self.latCount = dap.getGridDimensionLength(descriptor, self.options.query, self.latIndex)
            self.lonIndex = dap.getGridDimensionIndex(descriptor, self.options.query, self.options.longitude)
            self.lonCount = dap.getGridDimensionLength(descriptor, self.options.query, self.lonIndex)

            // build grid indexing string
            const dimensions = self.options.dimensions
            dimensions[self.options.latitude] = `0:${self.latCount-1}`
            dimensions[self.options.longitude] = `0:${self.lonCount-1}`
            const indices = dap.makeGridIndices(descriptor, self.options.query, dimensions)
            if (indices.length > 0) {
              // store dataset descriptor
              self.descriptor = descriptor
              // store grid indices
              self.indices = indices

              // fetch data to compute min/max values
              // TODO have this stored somewhere
              const wholeVariable = dap.makeGridQuery(self.options.url, self.options.query, indices)
              const onWholeVar = dap.fetchData(wholeVariable)
              onWholeVar.then(data => {
                const valData = data[0][0]
                const latData = data[0][self.latIndex+1]
                const lonData = data[0][self.lonIndex+1]
                self.minMaxVal = dap.getMinMaxGrid(valData, self.indices.length)
                self.minMaxLat = dap.getMinMaxArray(latData)
                self.minMaxLon = dap.getMinMaxArray(lonData)
                self.latStep = dap.getStep(latData)
                self.lonStep = dap.getStep(lonData)
                // normalize bounds
                if (self.minMaxLon[0] > 180.0) self.minMaxLon[0] -= 360.0
                if (self.minMaxLon[1] > 180.0) self.minMaxLon[1] -= 360.0
                // flag source as usable
                self.usable = true

                // notify view
                self.onDataChanged()
              })
            }
          }
        }
      }
    })
  }

  hasSpatialBounds () {
    return true
  }

  setColorMap (colorMap) {
    this.colorMap = colorMap
  }

  async fetchMesh (options, layerUniforms) {
    return new Promise((resolve, reject) => {
      const reqMinLat = options.bounds[0]
      const reqMinLon = options.bounds[1]
      const reqMaxLat = options.bounds[2]
      const reqMaxLon = options.bounds[3]
      if (!this.usable ||
          reqMaxLat <= this.minMaxLat[0] ||
          reqMinLat >= this.minMaxLat[1] ||
          reqMaxLon <= this.minMaxLon[0] ||
          reqMinLon >= this.minMaxLon[1]) {
        resolve(null)
      } else {
        const url = this.makeUrl(options)
        dap.fetchData(url).then(data => {
          const mesh = this.buildMesh(data[0], options, layerUniforms)
          resolve(mesh)
        })
      }
    })
  }

  makeUrl (options) {
    const reqMinLat = options.bounds[0]
    const reqMinLon = options.bounds[1]
    const reqMaxLat = options.bounds[2]
    const reqMaxLon = options.bounds[3]

    // compute coordinates indices
    let iMinLat = Math.floor(((reqMinLat - this.minMaxLat[0]) / this.latStep) - 1.0)
    let iMinLon = Math.floor(((reqMinLon - this.minMaxLon[0]) / this.lonStep) - 1.0)
    let iMaxLat = Math.ceil(((reqMaxLat - this.minMaxLat[0]) / this.latStep) + 1.0)
    let iMaxLon = Math.ceil(((reqMaxLon - this.minMaxLon[0]) / this.lonStep) + 1.0)

    iMinLat = this.latCount - 1 - iMinLat
    iMaxLat = this.latCount - 1 - iMaxLat

    // clamp indices
    iMinLat = Math.min(Math.max(iMinLat, 0), this.latCount - 1)
    iMinLon = Math.min(Math.max(iMinLon, 0), this.lonCount - 1)
    iMaxLat = Math.min(Math.max(iMaxLat, 0), this.latCount - 1)
    iMaxLon = Math.min(Math.max(iMaxLon, 0), this.lonCount - 1)

    const indices = [...this.indices]
    indices[this.latIndex] = `${iMaxLat}:${iMinLat}`
    indices[this.lonIndex] = `${iMinLon}:${iMaxLon}`
    return dap.makeGridQuery(this.options.url, this.options.query, indices)
  }

  buildMesh (data, options, layerUniforms) {
    const latData = data[this.latIndex+1]
    const lonData = data[this.lonIndex+1]

    // compute index range for requested bounds
    const reqMinLat = options.bounds[0]
    const reqMinLon = options.bounds[1]
    const reqMaxLat = options.bounds[2]
    const reqMaxLon = options.bounds[3]

    // normalize lon values
    for (let i = 0; i < lonData.length; ++i) {
      if (lonData[i] > 180.0) lonData[i] -= 360.0
    }

    // /!\ assumes arrays are sorted from biggest to smallest lat ..
    /*
    let iLat0 = 0
    let iLat1 = data[2].length - 1
    */
    let iLat0 = latData.length - 1
    let iLat1 = 0
    /*
    for (let ilat = 0; ilat < data[2].length; ++ilat) {
      const lat0 = data[2][ilat]
      const lat1 = data[2][(data[2].length - 1) - ilat]
      if (lat0 < reqMinLat) iLat0 = ilat
      if (lat1 > reqMaxLat) iLat1 = (data[2].length - 1) - ilat
      */
    for (let ilat = latData.length - 1; ilat >= 0; --ilat) {
      const lat0 = latData[ilat]
      const lat1 = latData[(latData.length - 1) - ilat]
      if (lat0 < reqMinLat) iLat0 = ilat
      if (lat1 > reqMaxLat) iLat1 = (latData.length - 1) - ilat
    }

    // /!\ assumes arrays are sorted from smallest to biggest lon ..
    let iLon0 = 0
    let iLon1 = lonData.length - 1
    for (let ilon = 0; ilon < lonData.length; ++ilon) {
      const lon0 = lonData[ilon]
      const lon1 = lonData[(lonData.length - 1) - ilon]
      if (lon0 < reqMinLon) iLon0 = ilon
      if (lon1 > reqMaxLon) iLon1 = (lonData.length - 1) - ilon
    }

    const mesh = this.buildSubMesh(data, Math.min(iLat0, iLat1), Math.max(iLat0, iLat1), iLon0, iLon1, layerUniforms)
    // update mesh's clip bound based on requested bounds
    mesh.shader.uniforms.latLonBounds = Float32Array.from([reqMinLat, reqMinLon, reqMaxLat, reqMaxLon])
    return mesh
  }

  buildSubMesh (data, iLat0, iLat1, iLon0, iLon1, layerUniforms) {
    const valData = data[0]
    const latData = data[this.latIndex+1]
    const lonData = data[this.lonIndex+1]

    const indices = [...this.indices]

    // compute grid size based on bounds
    const latCount = (iLat1 - iLat0) + 1
    const lonCount = (iLon1 - iLon0) + 1

    // allocate data buffers
    // const position = new Float32Array(2 * latCount * lonCount)
    const position = new Uint16Array(2 * latCount * lonCount)
    const color = new Uint8Array(4 * latCount * lonCount)

    const minLat = Math.min(latData[iLat0], latData[iLat1])
    const maxLat = Math.max(latData[iLat0], latData[iLat1])
    const minLon = Math.min(lonData[iLon0], lonData[iLon1])
    const maxLon = Math.max(lonData[iLon0], lonData[iLon1])

    const deltaLat = maxLat - minLat
    const deltaLon = maxLon - minLon

    // fill grid
    let vidx = 0
    let iidx = 0
    for (let ilon = 0; ilon < lonCount; ++ilon) {
      const lon = lonData[iLon0 + ilon]
      indices[this.lonIndex] = iLon0 + ilon

      for (let ilat = 0; ilat < latCount; ++ilat) {
        const lat = latData[iLat0 + ilat]
        position[vidx * 2] = toHalf((lat - minLat) / deltaLat)
        position[vidx * 2 + 1] = toHalf((lon - minLon) / deltaLon)
        /*
        position[vidx * 2] = lat
        position[vidx * 2 + 1] = lon
        */

        indices[this.latIndex] = iLat0 + ilat
        const val = dap.gridValue(valData, indices)
        const mapped = this.colorMap(val)
        const rgb = mapped.rgb()
        color[vidx * 4] = rgb[0]
        color[vidx * 4 + 1] = rgb[1]
        color[vidx * 4 + 2] = rgb[2]
        color[vidx * 4 + 3] = 255

        ++vidx
      }
    }

    // choose 16 or 32 bit index
    const maxIndex = (lonCount - 1) * latCount + (latCount - 1)
    const index = maxIndex > 65534 ?
          new Uint32Array((lonCount - 1) * (latCount * 2 + 1) - 1) :
          new Uint16Array((lonCount - 1) * (latCount * 2 + 1) - 1)
    const restart = maxIndex > 65534 ? 4294967295 : 65535
    for (let i = 0; i < lonCount - 1; ++i) {
      for (let j = 0; j < latCount; ++j) {
        index[iidx++] = j + (i+1) * latCount
        index[iidx++] = j + i * latCount
      }
      if (i !== lonCount - 2)
        index[iidx++] = restart
    }

    // build mesh
    let geometry = new PIXI.Geometry()
        .addAttribute('position', position, 2, false, 0x140b /*PIXI.TYPES.HALF_FLOAT*/)
        // .addAttribute('position', position, 2)
        .addAttribute('color', color, 4, true, PIXI.TYPES.UNSIGNED_BYTE)
        .addIndex(index)
    // PixiJS doc says it improves slighly performances
    // fails when using normalized UNSIGNED_BYTE color attribute
    // geometry.interleave()
    const state = new PIXI.State()
    state.culling = true
    state.blendMode = PIXI.BLEND_MODES.SCREEN

    const uniforms = {
      latLonBounds: Float32Array.from([minLat, minLon, maxLat, maxLon]),
      offsetScale: Float32Array.from([minLat, minLon, deltaLat, deltaLon]),
      layerUniforms: layerUniforms
    }
    const shader = new PIXI.Shader(this.program, uniforms)
    const mesh = new PIXI.Mesh(geometry, shader, state, PIXI.DRAW_MODES.TRIANGLE_STRIP)
    // const mesh = new PIXI.Mesh(geometry, shader, state, PIXI.DRAW_MODES.POINTS)
    return mesh
  }
}
