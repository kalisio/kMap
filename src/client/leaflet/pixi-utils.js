import * as PIXI from 'pixi.js'

export const vtxShaderSrc = `
  precision mediump float;

  attribute vec2 position;
  attribute vec4 color;
  // attribute float value;
  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  uniform float zoomLevel;
  uniform vec4 offsetScale;
  varying vec4 vColor;
  // varying float vValue;
  varying vec2 vLatLon;

  vec2 ConvertCoordinates(vec3 latLonZoom) {
    const float d = 3.14159265359 / 180.0;
    const float maxLat = 85.0511287798;     // max lat using Web Mercator, used by EPSG:3857 CRS
    const float R = 6378137.0;              // earth radius

    // project
    // float lat = max(min(maxLat, latLonZoom[0]), -maxLat);
    float lat = clamp(latLonZoom[0], -maxLat, maxLat);
    float sla = sin(lat * d);
    vec2 point = vec2(R * latLonZoom[1] * d, R * log((1.0 + sla) / (1.0 - sla)) / 2.0);

    // scale
    float scale = 256.0 * pow(2.0, latLonZoom[2]);

    // transform
    const float s = 0.5 / (3.14159265359 * R);
    const vec4 abcd = vec4(s, 0.5, -s, 0.5);

    return scale * ((point * abcd.xz) + abcd.yw);
  }

  void main() {
    vColor = color;
    // vValue = value;
    vLatLon = offsetScale.xy + position.xy * offsetScale.zw;
    // vLatLon = position.xy;
    vec2 projected = ConvertCoordinates(vec3(vLatLon, zoomLevel));
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(projected, 1.0)).xy, 0.0, 1.0);
  }`

export const frgShaderSrc = `
  precision mediump float;

  varying vec4 vColor;
  // varying float vValue;
  varying vec2 vLatLon;
  uniform float alpha;
  // uniform float cutValue;
  uniform vec4 latLonBounds;

  void main() {
    bvec4 outside = bvec4(lessThan(vLatLon, latLonBounds.xy), greaterThan(vLatLon, latLonBounds.zw));
    if (any(outside) || vColor.a != 1.0)
      discard;

    /*
    if (vValue < cutValue)
      discard;
    */

    gl_FragColor.rgb = vec3(vColor[0]*alpha, vColor[1]*alpha, vColor[2]*alpha);
    gl_FragColor.a = alpha;
  }`

export const toHalf = (function() {
   var floatView = new Float32Array(1);
   var int32View = new Int32Array(floatView.buffer);

   /* This method is faster than the OpenEXR implementation (very often
    * used, eg. in Ogre), with the additional benefit of rounding, inspired
    * by James Tursa?s half-precision code. */
   return function toHalf(val) {

     floatView[0] = val;
     var x = int32View[0];

     var bits = (x >> 16) & 0x8000; /* Get the sign */
     var m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
     var e = (x >> 23) & 0xff; /* Using int is faster here */

     /* If zero, or denormal, or exponent underflows too much for a denormal
      * half, return signed zero. */
     if (e < 103) {
       return bits;
     }

     /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
     if (e > 142) {
       bits |= 0x7c00;
       /* If exponent was 0xff and one mantissa bit was set, it means NaN,
        * not Inf, so make sure we set one mantissa bit too. */
       bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
       return bits;
     }

     /* If exponent underflows but not too much, return a denormal */
     if (e < 113) {
       m |= 0x0800;
       /* Extra rounding may overflow and set mantissa to 0 and exponent
        * to 1, which is OK. */
       bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
       return bits;
     }

     bits |= ((e - 112) << 10) | (m >> 1);
     /* Extra rounding. An overflow will set mantissa to 0 and increment
      * the exponent, which is OK. */
     bits += m & 1;
     return bits;
   };

}());

export class ColorMapHook {
    constructor (colormap, attribute) {
        this.colormap = colormap
        this.attribute = attribute
    }

    initialize (grid) {
        this.grid = grid
        const dims = grid.getDimensions()
        const latCount = dims[0]
        const lonCount = dims[1]
        this.color = new Uint8Array(4 * latCount * lonCount)
    }

    iterate (vidx, ilat, ilon) {
        const val = this.grid.getValue(ilat, ilon)
        const mapped = this.colormap(val)
        const rgb = mapped.rgb()
        this.color[vidx * 4] = rgb[0]
        this.color[vidx * 4 + 1] = rgb[1]
        this.color[vidx * 4 + 2] = rgb[2]
        this.color[vidx * 4 + 3] = 255
    }

    finalize (geometry) {
        geometry.addAttribute(this.attribute, this.color, 4, true, PIXI.TYPES.UNSIGNED_BYTE)
    }
}

export function buildPixiMeshFromGrid(grid, hooks) {
    const dims = grid.getDimensions()
    const latCount = dims[0]
    const lonCount = dims[1]

    // const position = new Float32Array(2 * latCount * lonCount)
    const position = new Uint16Array(2 * latCount * lonCount)
    for (const hook of hooks)
        hook.initialize(grid)

    const bbox = grid.getBBox()
    const minLat = bbox[0]
    const minLon = bbox[1]
    const maxLat = bbox[2]
    const maxLon = bbox[3]

    const deltaLat = maxLat - minLat
    const deltaLon = maxLon - minLon

    // fill attributes
    let vidx = 0
    for (let ilon = 0; ilon < lonCount; ++ilon) {
        const lon = grid.getLon(ilon)
        for (let ilat = 0; ilat < latCount; ++ilat) {
            const lat = grid.getLat(ilat)

            position[vidx * 2] = toHalf((lat - minLat) / deltaLat)
            position[vidx * 2 + 1] = toHalf((lon - minLon) / deltaLon)
            /*
            position[vidx * 2] = lat
            position[vidx * 2 + 1] = lon
            */

            for (const hook of hooks)
                hook.iterate(vidx, ilat, ilon)

            ++vidx
        }
    }

    // fill index
    let iidx = 0
    // choose 16 or 32 bit index
    const maxIndex = (lonCount - 1) * latCount + (latCount - 1)
    const index = maxIndex > 65534 ?
          new Uint32Array((lonCount - 1) * (latCount * 2 + 1) - 1) :
          new Uint16Array((lonCount - 1) * (latCount * 2 + 1) - 1)
    const restart = maxIndex > 65534 ? 4294967295 : 65535
    for (let i = 0; i < lonCount - 1; ++i) {
      for (let j = 0; j < latCount; ++j) {
        index[iidx++] = j + i * latCount
        index[iidx++] = j + (i+1) * latCount
      }
      if (i !== lonCount - 2)
        index[iidx++] = restart
    }

    const geometry = new PIXI.Geometry()
        .addAttribute('position', position, 2, false, 0x140b /*PIXI.TYPES.HALF_FLOAT*/)
        // .addAttribute('position', position, 2)
        .addIndex(index)

    for (const hook of hooks)
        hook.finalize(geometry)

    return geometry
}
