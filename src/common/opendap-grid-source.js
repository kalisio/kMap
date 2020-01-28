import { SortOrder, GridSource, Grid2D } from './grid'
import * as dap from './opendap-utils'

// https://opendap.github.io/documentation/UserGuideComprehensive.html#Constraint_Expressions

// only assumes grid variable is a regular grid w.r.t lat/lon
export class OpenDapGridSource extends GridSource {
  static getKey () {
    return 'opendap'
  }

  constructor () {
    super()

    this.usable = false
  }

  getBBox () {
    return [this.minMaxLat[0], this.minMaxLon[0], this.minMaxLat[1], this.minMaxLon[1]]
  }

  getDataBounds () {
    return this.minMaxVal
  }

  async setup (options) {
    this.options = options
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
    this.latStep = 0
    this.lonStep = 0
    this.latSortOrder = SortOrder.ASCENDING
    this.lonSortOrder = SortOrder.ASCENDING

    this.canUseGrid2D = false

    const descriptor = await dap.fetchDescriptor(this.options.url)
    if (!dap.variableIsGrid(descriptor, this.options.query)) throw new Error(`${this.options.query} is not a grid variable!`)
    if (!dap.variableIsArray(descriptor, this.options.latitude)) throw new Error(`${this.options.latitude} is expected to be an array variable!`)
    if (!dap.variableIsArray(descriptor, this.options.longitude)) throw new Error(`${this.options.longitude} is expected to be an array variable!`)

    const latIndex = dap.getGridDimensionIndex(descriptor, this.options.query, this.options.latitude)
    const latCount = dap.getGridDimensionLength(descriptor, this.options.query, latIndex)
    const lonIndex = dap.getGridDimensionIndex(descriptor, this.options.query, this.options.longitude)
    const lonCount = dap.getGridDimensionLength(descriptor, this.options.query, lonIndex)

    // build grid indexing array
    const dimensions = this.options.dimensions
    dimensions[this.options.latitude] = `0:${latCount - 1}`
    dimensions[this.options.longitude] = `0:${lonCount - 1}`
    const indices = dap.makeGridIndices(descriptor, this.options.query, dimensions)
    if (indices.length === 0) throw new Error('Couldn\'t create index array for grid')

    this.descriptor = descriptor
    this.indices = indices
    this.latCount = latCount
    this.latIndex = latIndex
    this.lonCount = lonCount
    this.lonIndex = lonIndex

    // if lat and lon dimensions are the last in the query, we can
    // use a Grid2D directly (cheaper on cpu)
    const last = this.indices.length - 1
    if ((this.latIndex === last && this.lonIndex === (last - 1)) ||
        (this.latIndex === (last - 1) && this.lonIndex === last)) {
      this.canUseGrid2D = true
    }

    // TODO: store metadata somewhere instead of requesting the whole variable
    await this.computeMetaDataFromData()

    // flag source as usable
    this.usable = true

    this.dataChanged()
  }

  async fetch (abort, bbox, resolution) {
    if (!this.usable) { return null }

    const query = this.makeQuery(bbox, resolution)
    if (!query) { return null }

    const data = await dap.fetchData(query, abort)
    const valData = data[0][0]
    const latData = data[0][this.latIndex + 1]
    const lonData = data[0][this.lonIndex + 1]

    const lat0 = latData[0]
    const lat1 = latData[latData.length - 1]
    let lon0 = lonData[0]
    let lon1 = lonData[lonData.length - 1]

    // normalize bounds
    if (lon0 > 180.0) lon0 -= 360.0
    if (lon1 > 180.0) lon1 -= 360.0
    const databbox = [Math.min(lat0, lat1), Math.min(lon0, lon1), Math.max(lat0, lat1), Math.max(lon0, lon1)]

    if (this.canUseGrid2D) {
      const indices = this.indices.slice(0, this.indices.length - 2)
      const subgrid = dap.gridValue(valData, indices)
      return new Grid2D(
        databbox, [latData.length, lonData.length],
        subgrid, this.latIndex < this.lonIndex, this.latSortOrder, this.lonSortOrder)
    }

    return new dap.OpenDAPGrid(
      databbox, [latData.length, lonData.length],
      valData, this.indices, this.latIndex, this.lonIndex,
      this.latSortOrder, this.lonSortOrder)
  }

  makeQuery (bbox, resolution) {
    const reqMinLat = bbox[0]
    const reqMinLon = bbox[1]
    const reqMaxLat = bbox[2]
    const reqMaxLon = bbox[3]

    // compute coordinates indices (assume lat/lon both ascending)
    let iMinLat = Math.floor((reqMinLat - this.minMaxLat[0]) / this.latStep)
    let iMinLon = Math.floor((reqMinLon - this.minMaxLon[0]) / this.lonStep)
    let iMaxLat = Math.ceil((reqMaxLat - this.minMaxLat[0]) / this.latStep)
    let iMaxLon = Math.ceil((reqMaxLon - this.minMaxLon[0]) / this.lonStep)

    // clamp indices
    iMinLat = Math.min(Math.max(iMinLat, 0), this.latCount - 1)
    iMinLon = Math.min(Math.max(iMinLon, 0), this.lonCount - 1)
    iMaxLat = Math.min(Math.max(iMaxLat, 0), this.latCount - 1)
    iMaxLon = Math.min(Math.max(iMaxLon, 0), this.lonCount - 1)

    if (this.latSortOrder === SortOrder.DESCENDING) {
      const tmp = iMinLat
      iMinLat = this.latCount - 1 - iMaxLat
      iMaxLat = this.latCount - 1 - tmp
    }
    if (this.lonSortOrder === SortOrder.DESCENDING) {
      const tmp = iMinLon
      iMinLon = this.lonCount - 1 - iMaxLon
      iMaxLon = this.lonCount - 1 - tmp
    }

    // compute ideal stride according to requested resolution
    const strideLat = Math.max(1, Math.floor(resolution[0] / this.latStep))
    const strideLon = Math.max(1, Math.floor(resolution[1] / this.lonStep))

    // eventually adjust iMLax{Lat,Lon} when using a stride != 1
    // this ensure we'll get our initial iMin/iMax range no matter
    // what the stride is
    if (strideLat > 1) {
      iMaxLat = Math.min(this.latCount - 1, iMaxLat + strideLat)
    }
    if (strideLon > 1) {
      iMaxLon = Math.min(this.lonCount - 1, iMaxLon + strideLon)
    }

    const indices = [...this.indices]
    indices[this.latIndex] = `${iMinLat}:${strideLat}:${iMaxLat}`
    indices[this.lonIndex] = `${iMinLon}:${strideLon}:${iMaxLon}`
    return dap.makeGridQuery(this.options.url, this.options.query, indices)
  }

  async computeMetaDataFromData () {
    // fetch whole variable to compute metadata
    const indices = [...this.indices]
    indices[this.latIndex] = `0:${this.latCount - 1}`
    indices[this.lonIndex] = `0:${this.lonCount - 1}`
    const allQuery = dap.makeGridQuery(this.options.url, this.options.query, indices)
    const all = await dap.fetchData(allQuery)

    // compute bounds
    const valData = all[0][0]
    const latData = all[0][this.latIndex + 1]
    const lonData = all[0][this.lonIndex + 1]
    this.minMaxVal = dap.getMinMaxGrid(valData, indices.length)
    // this.minMaxLat = dap.getMinMaxArray(latData)
    const lat0 = latData[0]
    const lat1 = latData[latData.length - 1]
    this.minMaxLat = [Math.min(lat0, lat1), Math.max(lat0, lat1)]
    // this.minMaxLon = dap.getMinMaxArray(lonData)
    const lon0 = lonData[0] > 180.0 ? lonData[0] - 360.0 : lonData[0]
    const lon1 = lonData[lonData.length - 1] > 180.0 ? lonData[lonData.length - 1] - 360.0 : lonData[lonData.length - 1]
    this.minMaxLon = [Math.min(lon0, lon1), Math.max(lon0, lon1)]

    // grid resolution
    this.latStep = (this.minMaxLat[1] - this.minMaxLat[0]) / (this.latCount - 1)
    this.lonStep = (this.minMaxLon[1] - this.minMaxLon[0]) / (this.lonCount - 1)

    // deduce whether lat/lon dimensions are store in ascending or descending order
    this.latSortOrder = lat0 < lat1 ? SortOrder.ASCENDING : SortOrder.DESCENDING
    this.lonSortOrder = lon0 < lon1 ? SortOrder.ASCENDING : SortOrder.DESCENDING
  }
}
