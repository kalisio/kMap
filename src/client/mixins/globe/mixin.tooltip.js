import _ from 'lodash'

let tooltipMixin = {
  methods: {
    applyTooltips (entities, options) {
      for (let i = 0; i < entities.values.length; i++) {
        let entity = entities.values[i]
        const tooltip = this.generateCesiumStyle('tooltip', entity, options)
        if (tooltip) {
          const position = this.getPositionForEntity(entity)
          // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child
          // Similarly ff entity already has a label we need a separated entity anyway
          // if (entity.label) {
          this.viewer.entities.add({ parent: entity, position, label: tooltip })
          // }
          // else entity.label = new Cesium.LabelGraphics(tooltip)
        }
      }
    },
    getDefaultTooltip (entity, options) {
      let tooltip
      if (entity.properties) {
        let properties = entity.properties.getValue(0)
        let cesiumOptions = options.cesium || options
        let tooltipStyle = _.merge({}, this.options.tooltip,
          cesiumOptions.tooltip, properties.tooltip)
        // Default content
        let text = tooltipStyle.text
        if (!text) {
          if (tooltipStyle.property) {
            text = _.get(properties, tooltipStyle.property)
          } else if (tooltipStyle.template) {
            const compiler = tooltipStyle.compiler
            text = compiler({ properties })
          }
        }
        if (text) {
          tooltip = Object.assign({
            text,
            show: (!!_.get(tooltipStyle, 'options.permanent'))
          }, tooltipStyle.options)
        }
      }
      return tooltip
    },
    isTooltipOpen (entity) {
      if (entity.label) return entity.label.show
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) return this.isTooltipOpen(this.getChildForEntity(entity))
      else return false
    },
    openTooltip (entity) {
      if (entity.label) entity.label.show = true
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) this.openTooltip(this.getChildForEntity(entity))
    },
    closeTooltip (entity) {
      if (entity.label) entity.label.show = false
      // FIXME: for now directly add the label to the entity does not seem to work so we add it as a child entity
      else if (this.getNbChildrenForEntity(entity) > 0) this.closeTooltip(this.getChildForEntity(entity))
    },
    onTooltip (options, event) {
      // Nothing to do in this case
      if (options && _.get(options, 'cesium.tooltip.permanent)')) return
      // FIXME: show/hide tooltip
      const entity = event.target
      if (this.overEntity) {
        this.closeTooltip(this.overEntity)
        this.overEntity = null
      }
      // Only for entities from a layer
      if (options && entity) {
        this.overEntity = entity
        this.openTooltip(this.overEntity)
      }
    }
  },
  created () {
    this.tooltipFactory = []
    this.registerCesiumStyle('tooltip', this.getDefaultTooltip)
    // Perform required conversion from JSON to Cesium objects
    if (this.options.tooltip) this.options.tooltip = this.convertToCesiumObjects(this.options.tooltip)
  },
  mounted () {
    this.$on('mousemove', this.onTooltip)
  },
  beforeDestroy () {
    this.$off('mousemove', this.onTooltip)
  }
}

export default tooltipMixin
