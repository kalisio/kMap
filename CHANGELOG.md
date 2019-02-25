# Change Log

## [v1.0.4](https://github.com/kalisio/kMap/tree/v1.0.4) (2019-02-25)
[Full Changelog](https://github.com/kalisio/kMap/compare/v1.0.3...v1.0.4)

**Implemented enhancements:**

- Create a time mixin [\#57](https://github.com/kalisio/kMap/issues/57)
- Add default clustering options for imported GeoJson layers [\#56](https://github.com/kalisio/kMap/issues/56)
- Allow for custom onEachFeature in Leaflet GeoJson layers [\#53](https://github.com/kalisio/kMap/issues/53)
- Make the LocationMap draggable using a prop [\#48](https://github.com/kalisio/kMap/issues/48)
- Remove KMap and KGlobe components [\#46](https://github.com/kalisio/kMap/issues/46)
- GeoJson layers does not support runtime mode in Globe [\#23](https://github.com/kalisio/kMap/issues/23)
- Geocoder service should be able to use various providers [\#10](https://github.com/kalisio/kMap/issues/10)

**Fixed bugs:**

- When aggregating distinct features on multiple elements values are mixed between features [\#54](https://github.com/kalisio/kMap/issues/54)
- collection-layer mixin is not working anymore [\#50](https://github.com/kalisio/kMap/issues/50)
- KLocationMap should import map mixins only [\#49](https://github.com/kalisio/kMap/issues/49)
- On mobile devices, the LocationMap  exceeds from the screen [\#47](https://github.com/kalisio/kMap/issues/47)

**Closed issues:**

- Multiple tooltips are stacked [\#52](https://github.com/kalisio/kMap/issues/52)

## [v1.0.3](https://github.com/kalisio/kMap/tree/v1.0.3) (2019-01-13)
[Full Changelog](https://github.com/kalisio/kMap/compare/v1.0.2...v1.0.3)

**Fixed bugs:**

- Make the Cesium token configurable [\#45](https://github.com/kalisio/kMap/issues/45)
- setupMap is broken [\#44](https://github.com/kalisio/kMap/issues/44)

## [v1.0.2](https://github.com/kalisio/kMap/tree/v1.0.2) (2019-01-10)
[Full Changelog](https://github.com/kalisio/kMap/compare/v1.0.1...v1.0.2)

**Implemented enhancements:**

- Allow feature service query to include a dynamic filter [\#42](https://github.com/kalisio/kMap/issues/42)
- Manage orientation in feature service [\#40](https://github.com/kalisio/kMap/issues/40)
- Allow aggregation of geometry in feature service [\#39](https://github.com/kalisio/kMap/issues/39)
- Allow to use kMap with Leaflet only or Cesium only or both [\#36](https://github.com/kalisio/kMap/issues/36)
- Update layer description format [\#34](https://github.com/kalisio/kMap/issues/34)
- Add the capability to visualize GeoTiff raster data [\#31](https://github.com/kalisio/kMap/issues/31)
- Create a color ramp legend [\#15](https://github.com/kalisio/kMap/issues/15)

**Fixed bugs:**

- The dom ID to create a map is hard coded [\#43](https://github.com/kalisio/kMap/issues/43)
- Aggregation query on feature service does not work with REST [\#41](https://github.com/kalisio/kMap/issues/41)
- Geolocation dialog cannot be dismissed on error [\#38](https://github.com/kalisio/kMap/issues/38)

**Closed issues:**

- Add a zoom to layer capability [\#37](https://github.com/kalisio/kMap/issues/37)

## [v1.0.1](https://github.com/kalisio/kMap/tree/v1.0.1) (2018-12-03)
[Full Changelog](https://github.com/kalisio/kMap/compare/v1.0.0...v1.0.1)

**Implemented enhancements:**

- Allow to aggregate features when querying a collection-layer service [\#29](https://github.com/kalisio/kMap/issues/29)
- Capability to create a GeoJson layer in map from URL [\#28](https://github.com/kalisio/kMap/issues/28)
- Integrate generic geometry relative functions/hooks from kCore/weacast-core [\#27](https://github.com/kalisio/kMap/issues/27)
- Categories in layer panel should not depend on type only [\#26](https://github.com/kalisio/kMap/issues/26)
- Create a timed WMS layer [\#25](https://github.com/kalisio/kMap/issues/25)
- Layers selector should provide a list of items instead of buttons [\#24](https://github.com/kalisio/kMap/issues/24)
- Standardize map/globe baheaviours [\#22](https://github.com/kalisio/kMap/issues/22)
- Ability to drag'n'drop local files to create layers [\#19](https://github.com/kalisio/kMap/issues/19)
- Layer service from MongoDB collection [\#18](https://github.com/kalisio/kMap/issues/18)
- Interoperability with Weacast [\#16](https://github.com/kalisio/kMap/issues/16)
- Create a layer control [\#13](https://github.com/kalisio/kMap/issues/13)
- Create a layer description service [\#12](https://github.com/kalisio/kMap/issues/12)

**Fixed bugs:**

- KLayersPanel is not reactive [\#21](https://github.com/kalisio/kMap/issues/21)
- Ability to drag'n'drop local files to create layers [\#19](https://github.com/kalisio/kMap/issues/19)

## [v1.0.0](https://github.com/kalisio/kMap/tree/v1.0.0) (2018-10-11)
**Implemented enhancements:**

- Let the capability to configure the marker used in the KLocationMap and consequently in the KLocationField [\#4](https://github.com/kalisio/kMap/issues/4)

**Fixed bugs:**

- Multiple error dialogs are stacked when a geolocation error occurs [\#9](https://github.com/kalisio/kMap/issues/9)
- Map is not refreshed when closing/opening the sideNav [\#7](https://github.com/kalisio/kMap/issues/7)

**Closed issues:**

- Fontawesome icon marker [\#5](https://github.com/kalisio/kMap/issues/5)
- Initiate the module [\#3](https://github.com/kalisio/kMap/issues/3)
- Initiate the module [\#2](https://github.com/kalisio/kMap/issues/2)

**Merged pull requests:**

- \[Snyk\] Fix for 1 vulnerable dependencies [\#11](https://github.com/kalisio/kMap/pull/11) ([snyk-bot](https://github.com/snyk-bot))
- \[Snyk Update\] New fixes for 1 vulnerable dependency path [\#8](https://github.com/kalisio/kMap/pull/8) ([snyk-bot](https://github.com/snyk-bot))



\* *This Change Log was automatically generated by [github_changelog_generator](https://github.com/skywinder/Github-Changelog-Generator)*