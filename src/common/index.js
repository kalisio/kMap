// We faced a bug in babel so that transform-runtime with export * from 'x' generates import statements in transpiled code
// Tracked here : https://github.com/babel/babel/issues/2877
// We tested the workaround given here https://github.com/babel/babel/issues/2877#issuecomment-270700000 with success so far
import * as errors from './errors'
import * as permissions from './permissions'
import { gridSourceFactories } from './grid'
import { OpenDapGridSource } from './opendap-grid-source'
import { WcsGridSource } from './wcs-grid-source'
import { GeoTiffGridSource } from './geotiff-grid-source'
import { WeacastGridSource } from './weacast-grid-source'

export { errors }
export { permissions }

// register factories for known grid sources
gridSourceFactories[OpenDapGridSource.getKey()] = function () { return new OpenDapGridSource() }
gridSourceFactories[WcsGridSource.getKey()] = function () { return new WcsGridSource() }
gridSourceFactories[GeoTiffGridSource.getKey()] = function () { return new GeoTiffGridSource() }
gridSourceFactories[WeacastGridSource.getKey()] = function () { return new WeacastGridSource() }
