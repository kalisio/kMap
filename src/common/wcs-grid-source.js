import * as GeoTIFF from 'geotiff'
import { SortOrder, GridSource, Grid1D } from './grid'
import * as wcs from './wcs-utils'

export class WcsGridSource extends GridSource {
    static getKey () {
        return 'wcs'
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

        this.minMaxLat = null
        this.minMaxLon = null
        this.minMaxVal = null

        this.queryFormat = null

        // const caps = await wcs.GetCapabilities(this.options.url)

        // check image/tiff is supported
        // const formats = wcs.GetSupportedFormats(caps)
        // make sure coverage is available
        // const coverages = wcs.GetOfferedCoverages(caps)

        // use DescribeCoverage to find out bbox
        const coverage = await wcs.DescribeCoverage(this.options.url, this.options.coverage)
        const bounds = wcs.GetCoverageSpatialBounds(coverage)
        const formats = wcs.GetSupportedFormats(coverage)

        this.queryFormat = formats[0]
        this.minMaxLat = [ bounds[0], bounds[2] ]
        this.minMaxLon = [ bounds[1], bounds[3] ]

        this.usable = true
    }

    async fetch (abort, bbox, resolution) {
        if (!this.usable)
            return null

        const reqMinLat = bbox[0]
        const reqMinLon = bbox[1]
        const reqMaxLat = bbox[2]
        const reqMaxLon = bbox[3]
        const width = Math.trunc((bbox[3] - bbox[1]) / resolution[1])
        const height = Math.trunc((bbox[2] - bbox[0]) / resolution[0])

        const wcsbbox = [reqMinLon, reqMinLat, reqMaxLon, reqMaxLat]

        const image = await wcs.GetCoverage(abort, this.options.url, this.options.coverage, this.queryFormat, wcsbbox, width, height)
        // geotiff.js will try to use a FileReader to read from the blob
        // this class doesn't exist in node.js so we use fromArrayBuffer
              .then(blob => blob.arrayBuffer())
              .then(buffer => GeoTIFF.fromArrayBuffer(buffer))
              .then(tiff => tiff.getImage())
        const data = image.readRasters()
        const databbox = image.getBoundingBox()
        const gridbbox = [databbox[1], databbox[0], databbox[3], databbox[2]]
        const dimensions = [image.getHeight(), image.getWidth()]
        return new Grid1D(gridbbox, dimensions, (await data)[0], true, SortOrder.DESCENDING, SortOrder.ASCENDING)
    }
}
