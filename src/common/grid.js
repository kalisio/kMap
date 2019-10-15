export const SortOrder = {
    ASCENDING  : 0,
    DESCENDING : 1
}

// Base 2d grid class
//
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
        throw ''
    }

    getIndices (lat, lon) {
        if (lat < this.bbox[0] || lat > this.bbox[2] || lon < this.bbox[1] || lon > this.bbox[2])
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
        throw ''
    }

    async setup (options) {
        throw ''
    }

    async fetch (bbox, resolution) {
        throw ''
    }
}

/*
export class Grid1D extends BaseGrid {
    constructor (bbox, dimensions) {
        super(bbox, dimensions)
    }

    getValue (ilat, ilon) {

    }
}
*/

// these allow to query grid with ascending lat/lon
const gridAccessFunctions = [
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
        this.getByIndex = gridAccessFunctions[index]
    }

    getValue (ilat, ilon) {
        return this.getByIndex(this.data, ilat, ilon, this.dimensions[0], this.dimensions[1])
    }
}
