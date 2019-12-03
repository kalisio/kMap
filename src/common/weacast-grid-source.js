import { SortOrder, GridSource, Grid1D } from './grid'
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
    }

    setCurrentTime (datetime) {
        this.currentTime = datetime
    }

    async fetch (abort, bbox, resolution) {
        if (!this.usable)
            return null

        const width = Math.trunc((bbox[3] - bbox[1]) / resolution[1])
        const height = Math.trunc((bbox[2] - bbox[0]) / resolution[0])

        const query = {
            time: this.currentForecastTime.format(),
            $select: ['forecastTime', 'data'],
            $paginate: false,
            // Resample according to input parameters
            oLon: this.wrapLongitude(bbox[1], this.model.bounds),
            oLat: bbox[2],
            sLon: width,
            sLat: height,
            dLon: resolution[1],
            dLat: resolution[0]
        }
        
        const results = await this.api.getService(this.service).find({ query })
        if (results.length === 0) return null
        else return new Grid1D(bbox, [width, height], results[0].data, true, SortOrder.DESCENDING, SortOrder.ASCENDING)
    }
}
