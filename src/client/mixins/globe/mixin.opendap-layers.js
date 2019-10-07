import _ from 'lodash'
import Cesium from 'cesium/Source/Cesium.js'

export default {
  methods: {
      createCesiumOpendapLayer (options) {
          const cesiumOptions = options.cesium
          // Check for valid type
          if (cesiumOptions.type !== 'opendap') return

          // const tilesetUrl =

          var tileset = new Cesium.Cesium3DTileset({
              url: 'http://127.0.0.1:3000/tileset.json?file=mf-arpege-05/2019/06/16/18/T6086_G_T_Sol_20190616180000.grib&variable=Temperature_surface&time=0',
              // shadows: Cesium.ShadowMode.DISABLED,
              // classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
              // url: Cesium.IonResource.f ffromAssetId(5741)
              // debugShowBoundingVolume: true,
              // debugShowUrl: true
          })

          /*
          tileset.style = new Cesium.Cesium3DTileStyle({
              color: 'mix(vec4(0,0,1,0.6), vec4(1,0,0,0.6), ${temperature})'
          })
          */

          return tileset
      }
  },
  created () {
    this.registerCesiumConstructor(this.createCesiumOpendapLayer)
  }
}
