import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import fs from 'fs'
import nock from 'nock'
import { makeGridSource } from '../src/common/grid'
import * as wcs from '../src/common/wcs-utils'

// returns the required byte range of the given file
// range is the raw value of the 'range' http header
function readRange(file, range) {
  const [ unit, value ] = range.split('=')
  if (unit !== 'bytes')
    return null

  const [ start, end ] = value.split('-')
  const offset = parseInt(start)
  const size = parseInt(end) - offset
  const data = Buffer.alloc(size)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, data, 0, size, offset)
  fs.closeSync(fd)
  return data
}

// checks that bboxa constains bboxb
// where bbox = [ minLat, minLon, maxLat, maxLon ]
function contains(bboxa, bboxb) {
  return bboxa[0] <= bboxb[0] && bboxa[1] <= bboxb[1] && bboxa[2] >= bboxb[2] && bboxa[3] >= bboxb[3]
}

describe('kMap:grid-source', () => {
  let source
  let sourceOptions

  before(() => {
    chailint(chai, util)
  })

  describe('wcs', () => {
    const wcsOptions = {
      wcs: {
        url: 'http://kMap.test/wcs',
        coverage: 'dummy'
      },
    }

    it('is possible to create a WCS source from makeGridSource', () => {
      const ret = makeGridSource(wcsOptions)
      source = ret[0]
      sourceOptions = ret[1]
      expect(source).to.exist
      expect(sourceOptions).to.deep.equal(wcsOptions.wcs)
    })

    it('setup correctly', async () => {
      const scope = nock('http://kMap.test')
            .get('/wcs')
            .query( { SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'DescribeCoverage', COVERAGE: wcsOptions.wcs.coverage } )
            .replyWithFile(200, __dirname + '/data/DescribeCoverage.xml')

      await source.setup(sourceOptions)
      const bbox = source.getBBox()
      expect(bbox[0]).to.be.closeTo(-60.009, 0.001)
      expect(bbox[1]).to.be.closeTo(-180.009, 0.001)
      expect(bbox[2]).to.be.closeTo(60.009, 0.01)
      expect(bbox[3]).to.be.closeTo(180.009, 0.01)
    })

    it('returns an appropriate grid when requesting data', async () => {
      const scope = nock('http://kMap.test')
            .get('/wcs')
            .query(true)
            .replyWithFile(200, __dirname + '/data/GetCoverage.tif', { 'Content-Type': 'image/tiff' })

      const fetchBBox = [ -10, -10, 10, 10 ]
      const fetchRes = [ 0.15, 0.15 ]
      const grid = await source.fetch(null, fetchBBox, fetchRes)
      const bbox = grid.getBBox()
      expect(bbox).to.satisfy((bbox) => contains(bbox, fetchBBox))
    })
  })

  describe('opendap', () => {
    const opendapOptions = {
      opendap: {
        url: 'http://kMap.test/dataset.grb',
        query: 'Temperature_height_above_ground',
        dimensions: { time: 0, height_above_ground: 0 },
        latitude: 'lat',
        longitude: 'lon'
      }
    }

    it('is possible to create an OPeNDAP source from makeGridSource', () => {
      const ret = makeGridSource(opendapOptions)
      source = ret[0]
      sourceOptions = ret[1]
      expect(source).to.exist
      expect(sourceOptions).to.deep.equal(opendapOptions.opendap)
    })

    it('setup correctly', async () => {
      const scope = nock('http://kMap.test')
            .get('/dataset.grb.dds')
            .replyWithFile(200, __dirname + '/data/dataset.grb.dds')
            .get('/dataset.grb.das')
            .replyWithFile(200, __dirname + '/data/dataset.grb.das')
            .get('/dataset.grb.dods')
            .query(true)
            .replyWithFile(200, __dirname + '/data/dataset.grb.dods')

      await source.setup(sourceOptions)
      const bbox = source.getBBox()
      expect(bbox[0]).to.be.closeTo(-90, 0.001)
      expect(bbox[1]).to.be.closeTo(-180, 0.001)
      expect(bbox[2]).to.be.closeTo(90, 0.001)
      expect(bbox[3]).to.be.closeTo(180, 0.001)
    })

    it('returns an appropriate grid when requesting data', async () => {
      const scope = nock('http://kMap.test')
            .get('/dataset.grb.dods')
            .query(true)
            .replyWithFile(200, __dirname + '/data/subdataset.grb.dods')

      const fetchBBox = [-10, -10, 10, 10]
      const fetchRes = [ 0.15, 0.15 ]
      const grid = await source.fetch(null, fetchBBox, fetchRes)
      const bbox = grid.getBBox()
      expect(bbox).to.satisfy((bbox) => contains(bbox, fetchBBox))
    })
  })

  describe('geotiff', () => {
    const geotiffOptions = {
      geotiff: {
        url: 'http://kMap.test/data.tif'
      }
    }

    it('is possible to create a GeoTiff source from makeGridSource', () => {
      const ret = makeGridSource(geotiffOptions)
      source = ret[0]
      sourceOptions = ret[1]
      expect(source).to.exist
      expect(sourceOptions).to.deep.equal(geotiffOptions.geotiff)
    })

    it('setup correctly', async () => {
      const scope = nock('http://kMap.test')
            .get('/data.tif')
            .reply(function (uri, requestBody) {
              const data = readRange(__dirname + '/data/GetCoverage.tif', this.req.headers.range)
              if (data) return [ 200, data ]
              return [ 404 ]
            })

      await source.setup(sourceOptions)
      const bbox = source.getBBox()
      expect(bbox[0]).to.be.closeTo(-10, 0.001)
      expect(bbox[1]).to.be.closeTo(-10, 0.001)
      expect(bbox[2]).to.be.closeTo(10, 0.001)
      expect(bbox[3]).to.be.closeTo(10, 0.001)
    })

    it('returns an appropriate grid when requesting data', async () => {
      const scope = nock('http://kMap.test')
            .get('/data.tif')
            .reply(function (uri, requestBody) {
              const data = readRange(__dirname + '/data/GetCoverage.tif', this.req.headers.range)
              if (data) return [ 200, data ]
              return [ 404 ]
            })

      const fetchBBox = [-5, -5, 5, 5]
      const fetchRes = [ 0.15, 0.15 ]
      const grid = await source.fetch(null, fetchBBox, fetchRes)
      const bbox = grid.getBBox()
      expect(bbox).to.satisfy((bbox) => contains(bbox, fetchBBox))
    })
  })

  /*
    after(() => {

    })
  */
})
