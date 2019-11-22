import * as PIXI from 'pixi.js'

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
       bits |= ((e === 255) ? 0 : 1) && (x & 0x007fffff);
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

export function buildColorMapFunction (options) {
    let thresholds = []
    let colors = []
    let interpolate = false
    if (options.domain) {
        colors = options.colors.slice()
        if (options.domain.length === options.colors.length) {
            thresholds = options.domain.slice()
        } else if (options.domain.length < options.colors.length) {
            const step = (options.domain[options.domain.length-1] - options.domain[0]) / (options.colors.length - 1)
            for (let i = 0; i < options.colors.length; ++i) {
                thresholds.push(options.domain[0] + (i * step))
            }
        }
        interpolate = true
    } else if (options.classes) {
        colors = options.colors.slice()
        thresholds = options.classes.slice()
        interpolate = false
    }

    if (options.invertScale) {
        thresholds = thresholds.reverse()
        colors = colors.reverse()
    }

    let code = 'vec4 ColorMap(float value) {\n'
    if (!interpolate) {
        for (let i = 0; i < thresholds.length; ++i) {
            const threshold = thresholds[i]
            const color = colors[i]
            code += `  if (value <= float(${threshold})) { return vec4(${color}); }\n`
        }
    } else {
        code += `  if (value < float(${thresholds[0]})) { return vec4(${colors[0].join(',')}); }\n`
        code += `  if (value > float(${thresholds[thresholds.length-1]})) { return vec4(${colors[colors.length-1].join(',')}); }\n`
        for (let i = 1; i < thresholds.length; ++i) {
            const t0 = thresholds[i-1]
            const t1 = thresholds[i]
            const dt = t1 - t0
            const c0 = colors[i-1]
            const c1 = colors[i]
            code += `  if (value <= float(${t1})) {
    float t = (value - float(${t0})) / float(${dt});
    return mix(vec4(${c0.join(',')}), vec4(${c1.join(',')}), t);
  }
`
        }
    }
    code += '}\n'
    return code
}

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

export class RawValueHook {
    constructor (attribute) {
        this.attribute = attribute
    }

    initialize (grid) {
        this.grid = grid
        const dims = grid.getDimensions()
        const latCount = dims[0]
        const lonCount = dims[1]
        this.value = new Float32Array(latCount * lonCount)
    }

    iterate (vidx, ilat, ilon) {
        const val = this.grid.getValue(ilat, ilon)
        this.value[vidx] = val
    }

    finalize (geometry) {
        geometry.addAttribute(this.attribute, this.value, 1, false, PIXI.TYPES.FLOAT)
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
