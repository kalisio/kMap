import _ from 'lodash'

export const SortOrder = {
    ASCENDING  : 0,
    DESCENDING : 1
}

export const gridSourceFactories = {  }

// Base 2d grid class
// TODO: add interpolate/bilinearInterpolate and other missing stuff from weacast grid
export class BaseGrid {
    constructor (bbox, dimensions) {
        this.bbox = bbox
        this.dimensions = dimensions
        this.resolution = [(bbox[2] - bbox[0]) / (dimensions[0] - 1), (bbox[3] - bbox[1]) / (dimensions[1] - 1)]
    }

    getDimensions () {
        return this.dimensions
    }

    getResolution () {
        return this.resolution
    }

    getBBox () {
        return this.bbox
    }

    getLat (ilat) {
        return this.bbox[0] + (ilat * this.resolution[0])
    }

    getLon (ilon) {
        return this.bbox[1] + (ilon * this.resolution[1])
    }

    getValue (ilat, ilon) {
        throw new Error('Not implemented')
    }

    getIndices (lat, lon) {
        if (lat < this.bbox[0] || lat > this.bbox[2] || lon < this.bbox[1] || lon > this.bbox[2])
            return null

        const ilat = (lat - this.bbox[0]) / this.resolution[0]
        const ilon = (lon - this.bbox[1]) / this.resolution[1]

        return [Math.floor(ilat), Math.floor(ilon)]
    }
}

export class GridSource {
    constructor () {
       
    }

    getBBox () {
        return null
    }

    getDataBounds () {
        throw new Error('Not implemented')
    }

    async setup (options) {
        throw new Error('Not implemented')
    }

    async fetch (abort, bbox, resolution) {
        throw new Error('Not implemented')
    }
}

export function makeGridSource (options) {
    for (const key of Object.keys(options)) {
        const factory = _.get(gridSourceFactories, key, null)
        if (factory)
            return [factory(), options[key]]
    }
    return null
}

// these allow to query grid with ascending lat/lon
const grid1DAccessFunctions = [
    // lonFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilon*latCount+ilat] },
    // lonFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[(lonCount-(ilon+1))*latCount+ilat] },
    // lonFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilon*latCount+(latCount-(ilat+1))] },
    // lonFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[(lonCount-(ilon+1))*latCount+(latCount-(ilat+1))] },

    // latFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilat*lonCount+ilon] },
    // latFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilat*lonCount+(lonCount-(ilon+1))] },
    // latFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[(latCount-(ilat+1))*lonCount+ilon] },
    // latFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[(latCount-(ilat+1))*lonCount+(lonCount-(ilon+1))] },
]

export class Grid1D extends BaseGrid {
    constructor (bbox, dimensions, data, latFirst, latSortOrder, lonSortOrder) {
        super(bbox, dimensions)

        this.data = data

        const index = lonSortOrder + (latSortOrder * 2) + ((latFirst ? 1 : 0) * 4)
        this.getByIndex = grid1DAccessFunctions[index]
    }

    getValue (ilat, ilon) {
        return this.getByIndex(this.data, ilat, ilon, this.dimensions[0], this.dimensions[1])
    }
}

// these allow to query grid with ascending lat/lon
const grid2DAccessFunctions = [
    // lonFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilon][ilat] },
    // lonFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[lonCount-(ilon+1)][ilat] },
    // lonFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilon][latCount-(ilat+1)] },
    // lonFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[lonCount-(ilon+1)][latCount-(ilat+1)] },

    // latFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilat][ilon] },
    // latFirst, latOrder=SortOrder.ASCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[ilat][lonCount-(ilon+1)] },
    // latFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.ASCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[latCount-(ilat+1)][ilon] },
    // latFirst, latOrder=SortOrder.DESCENDING, lonOrder=SortOrder.DESCENDING
    function (data, ilat, ilon, latCount, lonCount) { return data[latCount-(ilat+1)][lonCount-(ilon+1)] },
]

export class Grid2D extends BaseGrid {
    constructor (bbox, dimensions, data, latFirst, latSortOrder, lonSortOrder) {
        super(bbox, dimensions)
        this.data = data

        const index = lonSortOrder + (latSortOrder * 2) + ((latFirst ? 1 : 0) * 4)
        this.getByIndex = grid2DAccessFunctions[index]
    }

    getValue (ilat, ilon) {
        return this.getByIndex(this.data, ilat, ilon, this.dimensions[0], this.dimensions[1])
    }
}
