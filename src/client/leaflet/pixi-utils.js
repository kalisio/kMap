
export const vtxShaderSrc = `
  precision mediump float;

  attribute vec2 position;
  attribute vec4 color;
  uniform mat3 translationMatrix;
  uniform mat3 projectionMatrix;
  uniform float zoomLevel;
  uniform vec4 offsetScale;
  varying vec4 vColor;
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
    vLatLon = offsetScale.xy + position.xy * offsetScale.zw;
    // vLatLon = position.xy;
    vec2 projected = ConvertCoordinates(vec3(vLatLon, zoomLevel));
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(projected, 1.0)).xy, 0.0, 1.0);
  }`

export const frgShaderSrc = `
  precision mediump float;

  varying vec4 vColor;
  varying vec2 vLatLon;
  uniform float alpha;
  uniform vec4 latLonBounds;

  void main() {
    bvec4 outside = bvec4(lessThan(vLatLon, latLonBounds.xy), greaterThan(vLatLon, latLonBounds.zw));
    if (any(outside) || vColor.a != 1.0)
      discard;

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
