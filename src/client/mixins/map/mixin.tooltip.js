import L from 'leaflet'
import _ from 'lodash'

export default {
  methods: {
    getDefaultTooltip (feature, layer, options) {
      const properties = feature.properties
      let tooltip
      if (properties) {
        let leafletOptions = options.leaflet || options
        let tooltipStyle = Object.assign({}, this.options.tooltip,
          leafletOptions.tooltip, properties.tooltip)
        // Default content
        let html = tooltipStyle.html
        if (!html) {
          if (tooltipStyle.property) {
            html = (_.has(properties, tooltipStyle.property)
            ? _.get(properties, tooltipStyle.property) : _.get(feature, tooltipStyle.property))
          } else if (tooltipStyle.template) {
            const compiler = tooltipStyle.compiler
            html = compiler({ properties, feature })
          }
        }
        if (html) {
          tooltip = L.tooltip(tooltipStyle.options || { permanent: false }, layer)
          tooltip.setContent(html)
        }
      }
      return tooltip
    }
  },
  created () {
    this.registerLeafletStyle('tooltip', this.getDefaultTooltip)
  }
}
