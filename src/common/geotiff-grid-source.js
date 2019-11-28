import * as GeoTIFF from 'geotiff'
import { makeRemoteSource } from 'geotiff/dist/source.js'
import aws4 from 'aws4'
import fetch from 'node-fetch'
import { SortOrder, GridSource, Grid1D } from './grid'

function fetchFromS3 (url) {
    return async function (offset, length) {
        const res = new URL(url)
        let opts = {
            host: res.hostname,
            path: res.pathname,
            headers: { 'range': `bytes=${offset}-${offset + length}` }
        }
        // this relies on the existence of:
        // - AWS_SECRET_ACCESS_KEY
        // - AWS_ACCESS_KEY_ID
        // in the process environment
        opts = aws4.sign(opts)

        const response = await fetch(url, { headers: opts.headers })

        // check the response was okay and if the server actually understands range requests
        if (!response.ok) {
            throw new Error('Error fetching data.')
        } else if (response.status === 206) {
            const data = response.arrayBuffer ?
                  await response.arrayBuffer() : (await response.buffer()).buffer
            return {
                data,
                offset,
                length,
            }
        } else {
            const data = response.arrayBuffer ?
                  await response.arrayBuffer() : (await response.buffer()).buffer
            return {
                data,
                offset: 0,
                length: data.byteLength,
            }
        }
    }
}

function makeSource(options) {
    const source = makeRemoteSource(options.url, {})
    if (options.s3) {
        source.retrievalFunction = fetchFromS3(options.url)
    }

    return source
}

export class GeoTiffGridSource extends GridSource {
    static getKey () {
        return 'geotiff'
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
        this.nodata = options.nodata
        this.usable = false

        this.minMaxLat = null
        this.minMaxLon = null
        this.minMaxVal = null

        const source = makeSource(options)
        this.geotiff = await GeoTIFF.GeoTIFF.fromSource(source)

        // for now only consider first image
        // const count = await this.geotiff.getImageCount()
        const image = await this.geotiff.getImage()
        if (this.nodata === undefined) {
            // try to get it from image metadata
            // const meta = image.getGDALMetadata()
            const meta = image.getFileDirectory()
            this.nodata = parseFloat(meta.GDAL_NODATA)
        }

        const tiffBbox = image.getBoundingBox()
        this.minMaxLat = [ tiffBbox[1], tiffBbox[3] ]
        this.minMaxLon = [ tiffBbox[0], tiffBbox[2] ]

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

        let fetchBbox = [reqMinLon, reqMinLat, reqMaxLon, reqMaxLat]
        const data = await this.geotiff.readRasters({
            bbox: fetchBbox,
            // interleave: true,
            width: width,
            height: height,
            fillValue: this.nodata
        })

        return new Grid1D(bbox, [height, width], data[0], true, SortOrder.DESCENDING, SortOrder.ASCENDING, this.nodata)
    }
}
