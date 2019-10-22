import jsdap from 'jsdap'
import { BaseGrid } from './grid.js'

export const opendapTypes = new Set(['Float32', 'Float64'])

export async function fetchDescriptor(url) {
  return new Promise((resolve, reject) => {
    jsdap.loadDataset(url, descriptor => {
      resolve(descriptor)
    })
  })
}

export async function fetchData(abort, query) {
  /*
  return new Promise((resolve, reject) => {
    jsdap.loadData(query, data => {
      resolve(data)
    })
  })
  */

  const data = await window.fetch(query, { method: 'get', signal: abort })
        .then(response => response.arrayBuffer())
  const view = new DataView(data)

  // accumulate string till '\nData:\n' marker
  let dds = ''
  let byteIndex = 0
  while (byteIndex < view.byteLength) {
    const u8 = view.getUint8(byteIndex)
    if (u8 == '\n') {
      const str = String.fromCodePoint(
        view.getUint8(byteIndex+1),
        view.getUint8(byteIndex+2),
        view.getUint8(byteIndex+3),
        view.getUint8(byteIndex+4),
        view.getUint8(byteIndex+5),
        view.getUint8(byteIndex+6))
      if (str === 'Data:\n')
        break
    }

    dds += String.fromCodePoint(u8)
    ++byteIndex
  }

  const parser = new parser.ddsParser(dds)
  const dapvar = parser.parse()
  const unpacker = new xdr.dapUnpacker(data.slice(byteIndex+7), dapvar)
  return unpacker.getValue()
}

export function variableIsGrid(descriptor, variable) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return false;
  return varDesc.type === 'Grid'
}

export function variableIsArray(descriptor, variable) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return false;
  if (varDesc.shape === undefined)
    return false;
  return varDesc.shape.length == 1 && opendapTypes.has(varDesc.type)
}

export function getArrayVariableLength(descriptor, variable) {
  const varDesc = descriptor[variable]
  return varDesc.shape[0]
}

export function getGridDimensionLength(descriptor, variable, dimension) {
  const varDesc = descriptor[variable]
  return varDesc.array.shape[dimension]
}

export function makeGridIndices(descriptor, variable, dimensions) {
  const varDesc = descriptor[variable]
  let indices = []
  for (let i = 0; i < varDesc.array.dimensions.length; ++i) {
    const value = dimensions[varDesc.array.dimensions[i]]
    if (value === undefined)
      return []
    indices.push(value)
  }

  return indices
}

export function makeGridQuery(base, variable, indices) {
  // %5B = '[' %5D = ']'
  // query won't work if characters are not encoded
  return base + '.dods?' + variable + '%5B' + indices.join('%5D%5B') + '%5D'
}

export function getGridDimensionIndex(descriptor, variable, dimension) {
  const varDesc = descriptor[variable]
  if (varDesc === undefined)
    return -1
  return varDesc.array.dimensions.indexOf(dimension)
}

export function getMinMaxArray(vec) {
  const bounds = vec.reduce((accu, value) => {
    accu[0] = Math.min(accu[0], value)
    accu[1] = Math.max(accu[1], value)
    return accu
  }, [ vec[0], vec[0] ])
  return bounds
}

function getFirstGridValue(grid, dimension) {
  return dimension > 1 ? getFirstGridValue(grid[0], dimension-1) : grid[0]
}

/*
  function* iterateGrid(grid, dimension) {
  if (dimension > 1) {
  for (const r of grid)
  yield* iterateGrid(r, dimension-1)
  } else {
  for (const v of grid)
  yield v
  }
  }
*/

export function getMinMaxGrid(grid, dimension) {
  /* this implementation is 10x slower on chrome
     let minVal = getGridValue(grid, dimension)
     let maxVal = minVal
     for (const v of iterateGrid(grid, dimension)) {
     minVal = Math.min(minVal, v)
     maxVal = Math.max(maxVal, v)
     }
     return [minVal, maxVal]
  */

  if (dimension > 1) {
    const init = getFirstGridValue(grid, dimension)
    return grid.reduce((accu, value) => {
      const local = getMinMaxGrid(value, dimension-1)
      return [ Math.min(accu[0], local[0]), Math.max(accu[1], local[1]) ]
    }, [init, init])
  } else {
    return getMinMaxArray(grid)
  }
}

export function gridValue(grid, indices, offset = 0) {
  if (offset < indices.length - 1) {
    return gridValue(grid[indices[offset]], indices, offset+1)
  } else {
    return grid[indices[offset]]
  }
}

const makeIndicesFunctions = [
  // latSortOrder = SortOrder.ASCENDING, lonSortOrder = SortOrder.ASCENDING
  function (indices, latIndex, lonIndex, ilat, ilon, latCount, lonCount) {
    const local = [...indices]
    local[latIndex] = ilat
    local[lonIndex] = ilon
    return local
  },
  // latSortOrder = SortOrder.ASCENDING, lonSortOrder = SortOrder.DESCENDING
  function (indices, latIndex, lonIndex, ilat, ilon, latCount, lonCount) {
    const local = [...indices]
    local[latIndex] = ilat
    local[lonIndex] = lonCount - (ilon+1)
    return local
  },
  // latSortOrder = SortOrder.DESCENDING, lonSortOrder = SortOrder.ASCENDING
  function (indices, latIndex, lonIndex, ilat, ilon, latCount, lonCount) {
    const local = [...indices]
    local[latIndex] = latCount - (ilat+1)
    local[lonIndex] = ilon
    return local
  },
  // latSortOrder = SortOrder.DESCENDING, lonSortOrder = SortOrder.DESCENDING
  function (indices, latIndex, lonIndex, ilat, ilon, latCount, lonCount) {
    const local = [...indices]
    local[latIndex] = latCount - (ilat+1)
    local[lonIndex] = lonCount - (ilon+1)
    return local
  },
]

export class OpenDAPGrid extends BaseGrid {
  constructor (bbox, dimensions, data, indices, latIndex, lonIndex, latSortOrder, lonSortOrder) {
    super(bbox, dimensions)

    this.data = data
    this.indices = indices
    this.latIndex = latIndex
    this.lonIndex = lonIndex

    const index = lonSortOrder + (latSortOrder * 2)
    this.makeIndices = makeIndicesFunctions[index]
  }

  getValue (ilat, ilon) {
    const indices = this.makeIndices(this.indices, this.latIndex, this.lonIndex, ilat, ilon, this.dimensions[0], this.dimensions[1])
    return gridValue(this.data, indices)
  }
}
