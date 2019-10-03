import jsdap from 'jsdap'

export const opendapTypes = new Set(['Float32', 'Float64'])

export async function fetchDescriptor(url) {
  return new Promise((resolve, reject) => {
    jsdap.loadDataset(url, descriptor => {
      resolve(descriptor)
    })
  })
}

export async function fetchData(query) {
  return new Promise((resolve, reject) => {
    jsdap.loadData(query, data => {
      resolve(data)
    })
  })
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

export function getStep(vec) {
  let step = 0
  for (let i = 1; i < vec.length; ++i) {
    step += vec[i] - vec[i-1]
  }
  step /= vec.length
  /*
  let variance = 0
  for (let i = 1; i < vec.length; ++i) {
    const local = (vec[i] - vec[i-1]) - step
    variance += local * local
  }
  variance /= vec.length
  */
  return Math.abs(step)
}
