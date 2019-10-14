import _ from 'lodash'
import * as PIXI from 'pixi.js'
import jsdap from 'jsdap'
import { vtxShaderSrc, frgShaderSrc, toHalf } from './pixi-utils.js'

const opendapTypes = new Set(['Float32', 'Float64'])

async function fetchDescriptor(uri) {
  return new Promise((resolve, reject) => {
    jsdap.loadDataset(uri, descriptor => {
      resolve(descriptor)
    })
  })
}

async function fetchData(uri) {
  return new Promise((resolve, reject) => {
    jsdap.loadData(uri, data => {
      resolve(data)
    })
  })
}

function variableIsGrid(descriptor, variable) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return false;
  return varDesc.type === 'Grid'
}

function variableIsArray(descriptor, variable) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return false;
  if (varDesc.shape === undefined)
    return false;
  return varDesc.shape.length == 1 && opendapTypes.has(varDesc.type)
}

function makeGridQuery(descriptor, variable, dimensionIndices) {
  const varDesc = descriptor[variable]
  let query = ''
  for (let i = 0; i < varDesc.array.dimensions.length; ++i) {
    const dimIndex = dimensionIndices[varDesc.array.dimensions[i]]
    if (dimIndex === undefined)
      return ''
    // %5B = '[' %5D = ']'
    // query won't work if characters are not encoded
    query += `%5B${dimIndex}%5D`
  }

  return query
}

function makeUrl(base, variable, indices) {
  return base + '.dods?' + variable + indices
}

function getDimensionIndex(descriptor, variable, dimension) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return -1
  return varDesc.array.dimensions.indexOf(dimension)
}

function getMinMaxArray(vec) {
  const bounds = vec.reduce((accu, value) => {
    accu[0] = Math.min(accu[0], value)
    accu[1] = Math.max(accu[1], value)
    return accu
  }, [ vec[0], vec[0] ])
  return bounds
}

/*
function getMinMaxGrid(grid) {
  const bounds = grid.reduce((accu, value) => {
    if (value instanceof Array) {
      const local = getMinMaxGrid(value)
    } else {
      accu[0] = Math.min(accu[0], value)
      accu[1] = Math.max(accu[1], value)
    }
    return accu
  }, [ vec[0], vec[0] ])
  return bounds
}
*/

function getMinMaxGrid(grid) {
  const bounds = grid.reduce((accu, value) => {
    const local = value.reduce((accu, value) => {
      accu[0] = Math.min(accu[0], value)
      accu[1] = Math.max(accu[1], value)
      return accu
    }, [ value[0], value[0] ])
    return [ Math.min(accu[0], local[0]), Math.max(accu[1], local[1]) ]
  }, [ grid[0][0], grid[0][0] ])
  return bounds
}

// TODO
// proper compute min/max grid
// store min/max lat/lon/val somewhere
// store lat/lon steps somewhere
// query assumes a regular grid to compute correct indices
// check 'options' has everything we need
// flatten grid and have it indexed by lat/lon only?
// use null instead of undefined when no result

export class OPeNDAPMesh {
  constructor () {
    this.colormap = undefined
    this.program = undefined
    this.onDataChanged = undefined
  }

  initialize (options, onDataChanged) {
    // make sure options has the required fields
    // 'url' for dataset url
    // 'query' for the variable to query (must be a grid)
    // 'dimensions' values to prefill grid dimensions
    // 'latitude' variable to map to latitude
    // 'longitude' variable to map to longitude
    // assumes arrays are sorted from biggest to smallest lat ..
    // assumes arrays are sorted from smallest to biggest lon ..

    this.program = new PIXI.Program(vtxShaderSrc, frgShaderSrc, 'opendap-mesh-render')
    this.onDataChanged = onDataChanged
    this.reset(options)
  }

  reset (options) {
    this.usable = false
    this.descriptor = undefined
    this.indices = undefined
    this.latCount = 0
    this.latIndex = 0
    this.lonCount = 0
    this.lonIndex = 0
    this.minMaxLat = undefined
    this.minMaxLon = undefined
    this.minMaxVal = undefined

    // TODO: compute this
    this.latStep = 0.1
    this.lonStep = 0.1

    this.options = options.opendap

    const self = this
    const onDescriptor = fetchDescriptor(this.options.url)
    onDescriptor.then(descriptor => {
      if (variableIsGrid(descriptor, self.options.query)) {
        if (variableIsArray(descriptor, self.options.latitude)) {
          if (variableIsArray(descriptor, self.options.longitude)) {
            // build grid indexing string
            const dimensionIndices = self.options.dimensions
            dimensionIndices[self.options.latitude] = '$lat$'
            dimensionIndices[self.options.longitude] = '$lon$'
            const query = makeGridQuery(descriptor, self.options.query, dimensionIndices)
            if (query.length > 0) {
              // store dataset descriptor
              self.descriptor = descriptor
              // store index query
              self.indices = query
              // store handy dataset properties
              self.gridDimension = descriptor[self.options.query].array.dimensions.length
              self.latCount = descriptor[self.options.latitude].shape[0]
              self.latIndex = getDimensionIndex(descriptor, self.options.query, self.options.latitude)
              self.lonCount = descriptor[self.options.longitude].shape[0]
              self.lonIndex = getDimensionIndex(descriptor, self.options.query, self.options.longitude)

              // fetch data to compute min/max values
              // TODO have this stored somewhere
              const wholeVariable = makeUrl(self.options.url, self.options.query, query)
                    .replace('$lon$', `0:${self.lonCount-1}`)
                    .replace('$lat$', `0:${self.latCount-1}`)
              const onWholeVar = fetchData(wholeVariable)
              onWholeVar.then(data => {
                const grid = data[0][0]
                const latVec = data[0][self.latIndex+1]
                const lonVec = data[0][self.lonIndex+1]
                self.minMaxVal = getMinMaxGrid(grid[0]/*, self.gridDimension*/)
                self.minMaxLat = getMinMaxArray(latVec)
                self.minMaxLon = getMinMaxArray(lonVec)
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
        resolve(undefined)
      } else {
        const url = this.makeUrl(options)
        fetchData(url).then(data => {
          const mesh = this.buildMesh(data, options, layerUniforms)
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

    return makeUrl(this.options.url, this.options.query, this.indices)
      .replace('$lat$', `${iMaxLat}:${iMinLat}`)
      .replace('$lon$', `${iMinLon}:${iMaxLon}`)
  }

  buildMesh (root, options, layerUniforms) {
    const data = root[0]
    const latData = data[this.latIndex+1]
    const lonData = data[this.lonIndex+1]
    // assume data[0] is values data[1] is time data[2] is lat data[3] is lon

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
    const latData = data[this.latIndex+1]
    const lonData = data[this.lonIndex+1]

    // compute grid size based on bounds
    const latCount = (iLat1 - iLat0) + 1
    const lonCount = (iLon1 - iLon0) + 1

    // allocate data buffers
    // const position = new Float32Array(2 * latCount * lonCount)
    const position = new Uint16Array(2 * latCount * lonCount)
    const color = new Uint8Array(4 * latCount * lonCount)

    const grid = data[0][0]
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
      for (let ilat = 0; ilat < latCount; ++ilat) {
        const lat = latData[iLat0 + ilat]
        position[vidx * 2] = toHalf((lat - minLat) / deltaLat)
        position[vidx * 2 + 1] = toHalf((lon - minLon) / deltaLon)
        /*
        position[vidx * 2] = lat
        position[vidx * 2 + 1] = lon
        */

        const val = grid[iLat0 + ilat][iLon0 + ilon]
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
