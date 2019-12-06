import { SortOrder, GridSource, Grid1D, TiledGrid } from './grid'
import { getNearestForecastTime } from 'weacast-core/common'

export class WeacastGridSource extends GridSource {
    static getKey () {
        return 'weacast'
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
        this.api = options.api
        this.model = options.model
        this.service = options.model.name + '/' + options.element
        this.usable = false

        // Find nearest available data
        this.currentForecastTime = getNearestForecastTime(this.currentTime, this.model.interval)
        this.minMaxLat = [ this.model.bounds[1], this.model.bounds[3] ]
        // Internal tile management requires longitude in [-180, 180]
        const wrapLongitude = (this.model.bounds[2] === 360)
        this.minMaxLon = [ wrapLongitude ? -180 : this.model.bounds[0], wrapLongitude ? 180 : this.model.bounds[2] ]
        this.minMaxVal = null

        const query = {
            time: this.currentForecastTime.format(),
            $select: ['forecastTime', 'minValue', 'maxValue'],
            $paginate: false
        }
        
        const results = await this.api.getService(this.service).find({ query })
        if (results.length > 0) this.minMaxVal = [ results[0].minValue, results[0].maxValue ]

        this.usable = true

        this.dataChanged()
    }

    setCurrentTime (datetime) {
        this.currentTime = datetime
    }

    async fetch (abort, bbox, resolution) {
        if (!this.usable)
            return null

        const width = 1 + Math.trunc((bbox[3] - bbox[1]) / resolution[1])
        const height = 1 + Math.trunc((bbox[2] - bbox[0]) / resolution[0])

        const query = {
            time: this.currentForecastTime.format(),
            $select: ['forecastTime', 'data', 'geometry', 'size'],
            $paginate: false,
            // This is to target tiles instead of raw data
            geometry: {
                $geoIntersects: {
                    $geometry: {
                        type: "Polygon" ,
                         coordinates: [ // BBox as a polygon
                           [ [ bbox[1], bbox[0] ], [ bbox[3], bbox[0] ],
                             [ bbox[3], bbox[2] ], [ bbox[1], bbox[2] ], [ bbox[1], bbox[0] ] ] // Closing point
                         ]
                    }
                }
            }
            // This is to target raw data by resampling according to input parameters
            /*
            oLon: this.wrapLongitude(bbox[1], this.model.bounds),
            oLat: bbox[2],
            sLon: width,
            sLat: height,
            dLon: resolution[1],
            dLat: resolution[0]
            */
        }
        
        const results = await this.api.getService(this.service).find({ query })
        if (results.length === 0) return null
        else {
            // This is to target raw data
            //return new Grid1D(bbox, [width, height], results[0].data, true, SortOrder.DESCENDING, SortOrder.ASCENDING)
            // This is to target tiles instead of raw data
            const tiles = []
            for (const tile of results) {
                const tileBBox = tile.geometry.coordinates[0] // BBox as a polygon
                const tileBounds = [ tileBBox[0][1], tileBBox[0][0], tileBBox[2][1], tileBBox[2][0] ]
                tiles.push(new Grid1D(tileBounds, tile.size, tile.data, true, SortOrder.DESCENDING, SortOrder.ASCENDING))
            }
            return new TiledGrid(tiles)
        }
    }
}
