import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import { hooks } from '../src'

describe('kMap:hooks', () => {
  before(() => {
    chailint(chai, util)
  })

  it('marshalls geometry queries', () => {
    const hook = {
      type: 'before',
      params: {
        query: {
          geometry:
      { $near: { $geometry: { type: 'Point', coordinates: ['56', '0.3'] }, $maxDistance: '1000.50' } }
        }
      }
    }
    hooks.marshallGeometryQuery(hook)
    expect(typeof hook.params.query.geometry.$near.$geometry.coordinates[0]).to.equal('number')
    expect(typeof hook.params.query.geometry.$near.$geometry.coordinates[1]).to.equal('number')
    expect(hook.params.query.geometry.$near.$geometry.coordinates[0]).to.equal(56)
    expect(hook.params.query.geometry.$near.$geometry.coordinates[1]).to.equal(0.3)
    expect(typeof hook.params.query.geometry.$near.$maxDistance).to.equal('number')
    expect(hook.params.query.geometry.$near.$maxDistance).to.equal(1000.5)
  })

  // Cleanup
  after(async () => {
  })
})
