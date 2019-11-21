import * as GeoTIFF from 'geotiff'
import { makeFetchSource } from 'geotiff/dist/source.js'
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
    const source = makeFetchSource(options.url)
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
        this.options = options
        this.usable = false

        this.minMaxLat = null
        this.minMaxLon = null
        this.minMaxVal = null

        const source = makeSource(options)
        this.geotiff = await GeoTIFF.GeoTIFF.fromSource(source)

        // for now only consider first image
        // const count = await this.geotiff.getImageCount()
        const image = await this.geotiff.getImage()

        const tiffBbox = image.getBoundingBox()
        this.minMaxLat = [ tiffBbox[1], tiffBbox[3] ]
        this.minMaxLon = [ tiffBbox[0], tiffBbox[2] ]

        /*
        if (this.minMaxLon[0] > 180 || this.minMaxLon[1] > 180) {
            // this translates an input bbox with longitude [-180, 180]
            // to a bbox with longitude expressed as required for the source geotiff
            this.translateFetchBbox = function (bbox) {
                const tiffMinLon = tiffBbox[0]
                const tiffMaxLon = tiffBbox[2]
                let reqMinLon = bbox[0]
                const reqMinLat = bbox[1]
                let reqMaxLon = bbox[2]
                const reqMaxLat = bbox[3]

                if (reqMinLon < tiffMinLon) reqMinLon += 360.0
                if (reqMinLon > tiffMaxLon) reqMinLon -= 360.0
                if (reqMaxLon < tiffMinLon) reqMaxLon += 360.0
                if (reqMaxLon > tiffMaxLon) reqMaxLon -= 360.0

                return [ reqMinLon, reqMinLat, reqMaxLon, reqMaxLat ]
            }

            let minLon = this.minMaxLon[0]
            let maxLon = this.minMaxLon[1]
            if (minLon > 180) minLon -= 360
            if (maxLon > 180) maxLon -= 360
            this.minMaxLon[0] = Math.min(minLon, maxLon)
            this.minMaxLon[1] = Math.max(minLon, maxLon)
        } else {
            this.translateFetchBbox = null
        }

        if (this.minMaxLon[0] === this.minMaxLon[1]) {
            this.minMaxLon = [-180.0, 180.0]
        }
        */

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
        if (this.translateFetchBbox) {
            fetchBbox = this.translateFetchBbox(fetchBbox)
        }

        const data = await this.geotiff.readRasters({
            bbox: fetchBbox,
            // interleave: true,
            width: width,
            height: height,
            fillValue: this.options.nodata
        })

        if (this.options.nodata !== undefined) {
            let hasData = false
            for (let band = 0; band < data.length && hasData === false; ++band) {
                const bandData = data[band]
                for (let i = 0; i < bandData.length && hasData === false; ++i) {
                    if (bandData[i] !== this.options.nodata)
                        hasData = true
                }
            }
            if (!hasData)
                return null
        }

        return new Grid1D(bbox, [height, width], data[0], true, SortOrder.DESCENDING, SortOrder.ASCENDING)
    }
}
