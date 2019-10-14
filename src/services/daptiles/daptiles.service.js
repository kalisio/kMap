// import * as dap from '../../common/opendap-utils.js'
import makeDebug from 'debug'

const debug = makeDebug('kalisio:kMap:daptiles:service')

// const opendapUrl = 'https://thredds.irsn.kalisio.xyz/thredds/dodsC/'

// function toRadians(deg) {
//     return deg * (Math.PI / 180.0)
// }

// class TileBuilder {
//     constructor (datasetUrl, variable, key) {
//         this.datasetUrl = datasetUrl
//         this.variable = variable
//         this.key = key
//     }

//     async buildTileset (latitude, longitude, otherDimensions) {
//         this.latIndex = 0
//         this.latCount = 0
//         this.lonIndex = 0
//         this.lonCount = 0

//         const descriptor = await dap.fetchDescriptor(this.datasetUrl)

//         // perform a few sanity checks
//         /*
//           if (!dap.variableIsGrid(descriptor, this.variable))
//           return ?
//           if (!dap.variableIsArray(descriptor, query.latitude))
//           return ?
//           if (!dap.variableIsArray(descriptor, query.longitude))
//           return ?
//         */

//         this.latIndex = dap.getGridDimensionIndex(descriptor, this.variable, latitude)
//         this.latCount = dap.getGridDimensionLength(descriptor, this.variable, this.latIndex)
//         this.lonIndex = dap.getGridDimensionIndex(descriptor, this.variable, longitude)
//         this.lonCount = dap.getGridDimensionLength(descriptor, this.variable, this.lonIndex)

//         const dimensions = Object.assign({}, otherDimensions)
//         dimensions[query.latitude] = `0:${latCount-1}`
//         dimensions[query.longitude] = `0:${lonCount-1}`
//         const indices = dap.makeGridIndices(descriptor, this.variable, dimensions)
//         const query = dap.makeGridQuery(datasetUrl, this.variable, indices)

//         const data = await dap.fetchData(query)
//         const valData = data[0][0]
//         const latData = data[0][latIndex+1]
//         const lonData = data[0][lonIndex+1]

//         const minMaxLat = dap.getMinMaxArray(latData)
//         const minMaxLon = dap.getMinMaxArray(lonData)
//         const minMaxVal = dap.getMinMaxGrid(valData)

//         // normalize longitude
//         if (minMaxLon[0] > 180.0) minMaxLon[0] -= 360.0
//         if (minMaxLon[1] > 180.0) minMaxLon[1] -= 360.0
//         const lon0 = minMaxLon[0]
//         const lon1 = minMaxLon[1]
//         minMaxLon[0] = Math.min(lon0, lon1)
//         minMaxLon[1] = Math.max(lon0, lon1)

//         minMaxLat[0] = Math.max(minMaxLat[0], -90.0)
//         minMaxLat[1] = Math.min(minMaxLat[1],  90.0)
//         minMaxLon[0] = Math.max(minMaxLon[0], -180.0)
//         minMaxLon[1] = Math.min(minMaxLon[1],  180.0)

//         this.indices = indices
//         this.minMaxLat = minMaxLat
//         this.minMaxLon = minMaxLon
//         this.minMaxVal = minMaxVal

//         const tileset = {
//             asset: {
//                 version: '1.0',
//                 // tilesetVersion: "e575c6f1-a45b-420a-b172-6449fa6e0a59",
//             },
//             properties: {
//                 /*
//                   temperature: {
//                   minimum: minMaxVal[0] - 273.15,
//                   maximum: minMaxVal[1] - 273.15,
//                   },
//                 */
//             },
//             geometricError: 100000.0,
//             root: {
//                 boundingVolume: {
//                     region: [ toRadians(minMaxLon[0]), toRadians(minMaxLat[0]), toRadians(minMaxLon[1]), toRadians(minMaxLat[1]), 0, 20 ],
//                 },
//                 geometricError: 100000.0,
//                 refine: 'REPLACE',
//                 /*
//                   content: {
//                   uri: `content.vctr?file=${query.query.file}&variable=${query.query.variable}&time=${query.query.time}&s=0&n=${iLatMax}&w=0&e=${iLonMax}`,
//                   },
//                 */
//                 children: refineTile(query, latData, lonData, 0, latData.length, 0, lonData.length)
//                 // children: []
//             }
//         }

//         // store min max values of explored variables
//         tileset.properties[query.variable] = {
//             minimum: minMaxVal[0],
//             maximum: minMaxVal[1]
//         }

//         return tileset
//     }

//     async buildBatchedTile (box) {
//         const indices = [...this.indices]
//         // update indices
//         const lat0 = box[0]
//         const lat1 = lat0 + box[1]
//         const lon0 = box[2]
//         const lon1 = lon0 + box[3]
//         indices[this.latIndex] = `${lat0}:${lat1}`
//         indices[this.lonIndex] = `${lon0}:${lon1}`
//         const query = dap.makeGridQuery(this.datasetUrl, this.variable, indices)

//         const data = await dap.fetchData(query)

//         const valData = data[0][0]
//         const latData = data[0][this.latIndex]
//         const lonData = data[0][this.lonIndex]

//         const gltf = buildglTF(valData, latData, lonData)

//         const featureTableJSON = {
//             BATCH_LENGTH: 0,
//         }
//         const featureTableJSONBuffer = JSON.stringify(featureTableJSON, null, 0)
//         const featureTableJSONPaddingCount = (featureTableJSONBuffer.length % 8) ? 8 - (featureTableJSONBuffer.length % 8) : 0

//         const header = Buffer.alloc(28)
//         const featureTableJSONPadding = Buffer.alloc(featureTableJSONPaddingCount, 0x20)

//         let byteLength = header.length
//             + featureTableJSONBuffer.length + featureTableJSONPaddingCount /* + featureTableBinary.length */
//         // + batchTableJSONBuffer.length + batchTableJSONPaddingCount + batchTableBinary.length

//         for (const buf of gltf) {
//             byteLength += buf.length
//         }

//         hidx = 0
//         hidx += header.write('b3dm', hidx) // magic
//         hidx = header.writeUInt32LE(1, hidx) // version
//         hidx = header.writeUInt32LE(byteLength, hidx) // byteLength
//         hidx = header.writeUInt32LE(featureTableJSONBuffer.length + featureTableJSONPaddingCount, hidx) // featureTableJSONByteLength
//         hidx = header.writeUInt32LE(/* featureTableBinary.length */ 0, hidx) // featureTableBinaryByteLength
//         hidx = header.writeUInt32LE(/* batchTableJSONBuffer.length + batchTableJSONPaddingCount */ 0, hidx) // batchTableJSONByteLength
//         hidx = header.writeUInt32LE(/* batchTableBinary.length */ 0, hidx) // batchTableBinaryByteLength

//         const buffers = [ header, featureTableJSONBuffer, featureTableJSONPadding ]
//         return buffers.concat(gltf)
//     }

//     refineTile(query, lat, lon, iLat, latCount, iLon, lonCount) {
//         // const lonCount = e - w
//         // const latCount = n - s
//         const children = []
//         /*
//           if (latCount > 10 && lonCount > 10) {
//           const w0 = w
//           const w1 = w + Math.floor(lonCount / 2)
//           const s0 = s
//           const s1 = s + Math.floor(latCount / 2)
//           children.push(makeTile(query, lat, lon, w0, s0, w1, s1))
//           children[children.length - 1].children = refineTile(query, lat, lon, w0, s0, w1, s1)
//           children.push(makeTile(query, lat, lon, w0, s1, w1,  n))
//           children[children.length - 1].children = refineTile(query, lat, lon, w0, s1, w1,  n)
//           children.push(makeTile(query, lat, lon, w1, s0,  e, s1))
//           children[children.length - 1].children = refineTile(query, lat, lon, w1, s0,  e, s1)
//           children.push(makeTile(query, lat, lon, w1, s1,  e,  n))
//           children[children.length - 1].children = refineTile(query, lat, lon, w1, s1,  e,  n)
//           }
//         */

//         const ustep = 40
//         const vstep = 40
//         const utiles = Math.floor(lonCount / ustep) /*+ (lonCount % 10 !== 0 ? 1 : 0)*/
//         const vtiles = Math.floor(latCount / vstep) /*+ (latCount % 10 !== 0 ? 1 : 0)*/
//         let startu = iLon
//         let startv = iLat
//         for (let u = 0; u < utiles; ++u) {
//             const u0 = startu
//             const u1 = Math.min(u0 + ustep, e)
//             for (let v = 0; v < vtiles; ++v) {
//                 const v0 = startv
//                 const v1 = Math.min(v0 + vstep, n)
//                 // children.push(makeTile(query, lat, lon, u0, v0, u1, v1))
//                 const tile = makeTile(query, lat, lon, u0, u1-u0, v0, v1-v0)
//                 if (tile !== undefined)
//                     children.push(tile)
//                 startv += (vstep - 1)
//             }
//             startu += (ustep - 1)
//             startv = iLat
//         }

//         return children
//     }

//     makeTile(query, lat, lon, iLat, latCount, iLon, lonCount) {
//         let minLat = lat[iLat]
//         let maxLat = lat[iLat]
//         let minLon = lon[iLon]
//         let maxLon = lon[iLon]
//         for (let i = iLat+1; i < latCount; ++i) {
//             minLat = Math.min(minLat, lat[i])
//             maxLat = Math.max(maxLat, lat[i])
//         }
//         for (let i = iLon+1; i < lonCount; ++i) {
//             minLon = Math.min(minLon, lon[i])
//             maxLon = Math.max(maxLon, lon[i])
//         }

//         /**/
//         if (minLon > 180.0) minLon -= 360.0
//         if (maxLon > 180.0) maxLon -= 360.0
//         const lon0 = minLon
//         const lon1 = maxLon
//         minLon = Math.min(lon0, lon1)
//         maxLon = Math.max(lon0, lon1)
//         /**/

//         minLat = Math.max(minLat, -90.0)
//         maxLat = Math.min(maxLat,  90.0)
//         minLon = Math.max(minLon, -180.0)
//         maxLon = Math.min(maxLon,  180.0)

//         /*
//           if (minLon > 20 || maxLon < -20 || maxLat < 40 || minLat > 60)
//           return undefined
//         */

//         return {
//             boundingVolume: {
//                 region: [toRadians(minLon), toRadians(minLat), toRadians(maxLon), toRadians(maxLat), 0, 20]
//             },
//             geometricError: 100000.0,
//             refine: 'REPLACE',
//             content: {
//                 // uri: `content.vctr?file=${query.query.file}&variable=${query.query.variable}&time=${query.query.time}&w=${w}&e=${e}&s=${s}&n=${n}`
//                 // uri: `content.i3dm?file=${query.query.file}&variable=${query.query.variable}&time=${query.query.time}&w=${w}&e=${e}&s=${s}&n=${n}`
//                 uri: `content.b3dm?key=${this.key}&box=${iLat},${latCount},${iLon},${lonCount}`
//             },
//             // children: []
//         }
//     }

//     buildglTF (valData, latData, lonData) {
//         const vertexCount = latData.length * lonData.length
//         const indexCount = (latData.length - 1) * (lonData.length - 1) * 6
//         const positions = Buffer.alloc(vertexCount * 3 * 4)
//         const colors = Buffer.alloc(vertexCount * 4)
//         const indices = vertexCount > 65535 ?
//               Buffer.alloc(indexCount * 4) : Buffer.alloc(indexCount * 2)

//         let writeIndex = vertexCount > 65535 ?
//             function(index, offset) { return indices.writeUInt32LE(index, offset) } :
//             function(index, offset) { return indices.writeUInt16LE(index, offset) }

//         // fill indices
//         let iidx = 0
//         let minIdx = 0
//         let maxIdx = vertexCount - 1
//         for (let i = 1; i < lonData.length; ++i) {
//             for (let j = 0; j < latData.length - 1; ++j) {
//                 const i0 = j + (i-1) * latData.length
//                 const i1 = i0 + 1
//                 const i2 = i1 + latData.length
//                 const i3 = i0 + latData.length

//                 iidx = writeIndex(i0, iidx)
//                 iidx = writeIndex(i1, iidx)
//                 iidx = writeIndex(i2, iidx)
//                 iidx = writeIndex(i0, iidx)
//                 iidx = writeIndex(i2, iidx)
//                 iidx = writeIndex(i3, iidx)
//             }
//         }

//         let scale = chromajs.scale('YlOrRd').domain(dataSetTempBounds)
//         // let scale = chromajs.scale('RdYlBu').domain([ dataSetTempBounds[1], dataSetTempBounds[0] ])
//         // let scale = chromajs.scale('Spectral').domain([ dataSetTempBounds[1], dataSetTempBounds[0] ])

//         // fill attributes
//         let vidx = 0
//         let cidx = 0
//         let maxVtxX = -4294967295.0
//         let minVtxX =  4294967295.0
//         let maxVtxY = -4294967295.0
//         let minVtxY =  4294967295.0
//         let maxVtxZ = -4294967295.0
//         let minVtxZ =  4294967295.0
//         for (let lo = 0; lo < lonData.length; ++lo) {
//             if (lonData[lo] > 180.0) lonData[lo] -= 360.0
//             for (let la = 0; la < latData.length; ++la) {
//                 /**/
//                 // const longitude = lon[lon]
//                 // if (longitude > 180.0) longitude -= 360.0
//                 // const pos = cesium.Cartesian3.fromDegrees(longitude, lat[la], 100)
//                 /**/
//                 const pos = cesium.Cartesian3.fromDegrees(lonData[lo], latData[la], 8000)
//                 maxVtxX = Math.max(maxVtxX, pos.x)
//                 minVtxX = Math.min(minVtxX, pos.x)
//                 maxVtxY = Math.max(maxVtxY, pos.y)
//                 minVtxY = Math.min(minVtxY, pos.y)
//                 maxVtxZ = Math.max(maxVtxZ, pos.z)
//                 minVtxZ = Math.min(minVtxZ, pos.z)
//                 vidx = positions.writeFloatLE(pos.x, vidx)
//                 vidx = positions.writeFloatLE(pos.y, vidx)
//                 vidx = positions.writeFloatLE(pos.z, vidx)

//                 const value = dap.gridValue(valData, la, lo)
//                 const color = scale(value).rgb()
//                 cidx = colors.writeUInt8(color[0], cidx)
//                 cidx = colors.writeUInt8(color[1], cidx)
//                 cidx = colors.writeUInt8(color[2], cidx)
//                 cidx = colors.writeUInt8(160, cidx)
//             }
//         }

//         const positionPaddingCount = 0
//         const positionPadding = Buffer.alloc(positionPaddingCount, 0)

//         const gltfJSON = {
//             asset: {
//                 version: '2.0'
//             },
//             scenes : [ { nodes: [ 0 ] } ],
//             nodes : [ {
//                 matrix: [1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1],
//                 mesh: 0
//             } ],
//             meshes: [ {
//                 primitives: [ {
//                     attributes: {
//                         POSITION: 1,
//                         COLOR_0: 2
//                     },
//                     indices: 0,
//                     mode: 4, // TRIANGLES
//                     material: 0
//                 } ],
//             } ],
//             materials: [ {
//                 alphaMode: 'BLEND'
//             } ],
//             accessors: [ {
//                 bufferView: 0,
//                 byteOffset: 0,
//                 componentType: vertexCount > 65535 ? 5125 : 5123, // uint32 : uint16
//                 count: indexCount,
//                 max: [ vertexCount - 1 ],
//                 min: [ 0 ],
//                 type: 'SCALAR'
//             }, {
//                 bufferView: 1,
//                 byteOffset: 0,
//                 componentType: 5126, // float
//                 count: vertexCount,
//                 max: [ maxVtxX, maxVtxY, maxVtxZ ],
//                 min: [ minVtxX, minVtxY, minVtxZ ],
//                 type: 'VEC3'
//             }, {
//                 bufferView: 2,
//                 byteOffset: 0,
//                 componentType: 5121, // uint8
//                 count: vertexCount,
//                 normalized: true,
//                 /*
//                   max: [ maxVtxX, maxVtxY, maxVtxZ ],
//                   min: [ minVtxX, minVtxY, minVtxZ ],
//                 */
//                 type: 'VEC4'
//             } ],
//             bufferViews: [ {
//                 buffer: 0,
//                 byteOffset: 0,
//                 byteLength: indices.length,
//                 target: 34963 // ELEMENT_ARRAY_BUFFER
//             }, {
//                 buffer: 0,
//                 byteOffset: indices.length + positionPadding.length,
//                 byteLength: positions.length,
//                 byteStride: 12,
//                 target: 34962 // ARRAY_BUFFER
//             }, {
//                 buffer: 0,
//                 byteOffset: indices.length + positionPadding.length + positions.length,
//                 byteLength: colors.length,
//                 byteStride: 4,
//                 target: 34962 // ARRAY_BUFFER
//             } ],
//             buffers : [ {
//                 byteLength: indices.length + positionPaddingCount + positions.length + colors.length,
//             } ]
//         }
//         const gltfJSONBuffer = JSON.stringify(gltfJSON, null, 0)
//         const gltfJSONChunk = Buffer.alloc(2 * 4)
//         const gltfHeader = Buffer.alloc(12)

//         let offset = gltfHeader.length + gltfJSONChunk.length + gltfJSONBuffer.length
//         const gltfJSONPaddingCount = (offset % 4 !== 0) ? 4 - offset % 4 : 0
//         const gltfJSONPadding = Buffer.alloc(gltfJSONPaddingCount, 0x20)

//         let bidx = 0
//         bidx = gltfJSONChunk.writeUInt32LE(gltfJSONBuffer.length + gltfJSONPadding.length, bidx) // chunkLength
//         bidx = gltfJSONChunk.writeUInt32LE(0x4E4F534A, bidx) // chunkType (JSON)

//         offset += gltfJSONPadding.length
//         const gltfBinaryChunk = Buffer.alloc(2 * 4)

//         bidx = 0
//         bidx = gltfBinaryChunk.writeUInt32LE(indices.length + positionPadding.length + positions.length + colors.length, bidx) // chunkLength
//         bidx = gltfBinaryChunk.writeUInt32LE(0x004E4942, bidx) // chunkType (binary)

//         offset += gltfBinaryChunk.length + indices.length + positionPadding.length + positions.length + colors.length

//         bidx = 0
//         bidx += gltfHeader.write('glTF', bidx) // magic
//         bidx = gltfHeader.writeUInt32LE(2, bidx) // version
//         bidx = gltfHeader.writeUInt32LE(offset, bidx) // length

//         return [ gltfHeader
//                  , gltfJSONChunk, gltfJSONBuffer, gltfJSONPadding
//                  , gltfBinaryChunk, indices, positionPadding, positions, colors ]
//     }
// }

export default function(name, app, options) {
    // Keep track of config
    Object.assign(options, app.get('daptiles'))
    debug('daptiles created with config ', options)

    return {
        async get(id, params) {
            // either requesting tileset json
            // either requesting tile content
            /*
            if (id.endsWith('b3dm')) {
                // const tile = await buildBatchedTile(id, query)
                // return tile
                const builder = this.builders[params.key]
                return builder.buildBatchedTile(params.box.split(','))
            } else if (id.endsWith('json')) {
                // http://stuff.com/tileset.json?file=....&variable=...&dimensions=
                // const tileset = await buildTileset(id, query)
                // return JSON.stringify(tileset)
                const datasetUrl = [opendapUrl, params.file].join('')
                const key = this.builders.length
                const builder = new TileBuilder(datasetUrl, params.variable, key)
                this.builders.push(builder)
                return builder.buildTileset(params.latitude, params.longitude, params.dimensions)
            }
            */

            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve('hello!')
                }, 500)
            })
        }
    }
}
