import math from 'mathjs'

// TODO the following was taken from Weacast's legend mixin, however maybe we should get this from a config file?
// Add knot unit not defined by default
math.createUnit('knot', { definition: '0.514444 m/s', aliases: ['knots', 'kt', 'kts'] })

const COLOR_STEPS = 10

export default {
  data () {
    return {
      legendLayer: null,
      legendEngineLayer: null,
      // These are the properties for the KColorLegend component, which are calculated from the 'active' layer.
      // If there are no visible/active layers then we set "visible" to false to completely hide the color legend.
      colorLegend: {
        visible: false,
        unit: null,
        hint: null,
        colorMap: null,
        colors: null,
        values: null,
        unitValues: null,
        showGradient: false
      }
    }
  },
  computed: {
    colorLegendStyle () {
      return {
        left: '18px',
        top: 0.25 * this.engineContainerHeight + 'px',
        height: 0.50 * this.engineContainerHeight + 'px',
        width: '40px',
        border: '1px solid lightgrey',
        fontSize: '12px'
      }
    }
  },
  methods: {
    onColorLegendShowLayer (layer, engineLayer) {
      // Check for valid types
      const colorMap = _.get(layer, 'variables[0].chromajs')
      if (!colorMap) return
      // We call Vue.nextTick() to let Vue update its DOM when (re)displaying the color legend for the newly selected layer
      this.$nextTick(() => {
        // It is required data is here to get color map object ready
        if (engineLayer.hasData) this.addColorLegend(layer, engineLayer)
        // If not wait until data is here
        else engineLayer.once('data', () => this.addColorLegend(layer, engineLayer))
      })
    },
    onColorLegendHideLayer (layer) {
      if (this.legendLayer && ((this.legendLayer._id === layer._id) || (this.legendLayer.name === layer.name))) {
        this.hideColorLegend()
      }
    },
    addColorLegend (layer, engineLayer) {
      this.updateColorLegend(layer, engineLayer)
    },
    hideColorLegend () {
      this.updateColorLegend(null)
    },
    setColorLegend (visible, unit, hint, colorMap, colors, values, unitValues, showGradient) {
      this.colorLegend.visible = visible
      this.colorLegend.unit = unit
      this.colorLegend.hint = hint
      this.colorLegend.colorMap = colorMap
      this.colorLegend.colors = colors
      this.colorLegend.values = values
      this.colorLegend.unitValues = unitValues
      this.colorLegend.showGradient = showGradient
    },
    resetColorLegend () {
      this.setColorLegend(false, null, null, null, null, null, null, false)
    },
    updateColorLegend (layer, engineLayer) {
      this.legendLayer = layer
      this.legendEngineLayer = engineLayer

      // Reset & hide the color legend
      if (!this.legendLayer) {
        this.resetColorLegend()
      } else {
        const colorMap = this.legendEngineLayer.colorMap
        const scale = _.get(this.legendLayer, 'variables[0].chromajs.scale')
        const units = this.getColorLegendUnits()
        const unit = !units || units.length === 0 ? null : units[0]
        const hint = this.getColorLegendHint(units, unit, this.legendLayer.name)
        const [ showGradient, colors, values, unitValues ] =
          this.getColorLegendValues(colorMap, scale, units, unit, COLOR_STEPS)

        // We don't have units or steps for this layer, hide it
        if (unit === null || values.length === 0) {
          this.hideColorLegend()

        // Units and steps (re)calculated, update the color legend
        } else {
          this.setColorLegend(true, unit, hint, colorMap, colors, values, unitValues, showGradient)
        }
      }
    },
    // Color legend was clicked - toggle to the next unit
    onColorLegendClick (event) {
      const colorMap = this.legendEngineLayer.colorMap
      const scale = _.get(this.legendLayer, 'variables[0].chromajs.scale')
      const units = this.getColorLegendUnits()

      // There's only one unit, no toggling to do, we're done
      if (units.length <= 1) {
        return
      }

      // Get next unit and recalculate hint and steps
      const nextUnit = this.getNextUnit(units, event.unit)
      const hint = this.getColorLegendHint(units, nextUnit, this.legendLayer.name)
      const [ showGradient, colors, values, unitValues ] =
        this.getColorLegendValues(colorMap, scale, units, nextUnit, COLOR_STEPS)

      // Units and steps (re)calculated, update the color legend
      this.setColorLegend(true, nextUnit, hint, colorMap, colors, values, unitValues, showGradient)
    },
    getColorLegendUnits () {
      return _.get(this.legendLayer, 'variables[0].units')
    },
    getColorLegendHint (units, unit, layerName) {
      if (!units || units.length <= 1 || !unit) {
        return null
      }

      // Determine hint by calling "this.getNextUnit"
      const nextUnit = this.getNextUnit(units, unit)

      return this.$t('mixins.legend.CONVERT_UNITS', { layer: layerName, unit: nextUnit })
    },
    getColorLegendValues (colorMap, scale, units, unit, steps) {
      if (!colorMap || !units || units.length === 0 || !unit) return []

      let showGradient
      let colors
      let values
      let unitValues
      const unitFrom = units[0]   // base unit
      const unitTo = unit

      function valueMap (value) {
        let unitValue = math.unit(value, unitFrom).toNumber(unitTo)
        return Math.round(unitValue, 0).toFixed(0)
      }

      const classes = colorMap.classes()
      // Some tricky logic below:
      //
      // - Depending on whether we have one unit or more than one unit, we perform a unit conversion (or not)
      // - Depending on whether we have 'classes' (predefined values) or not, we display a color 'gradient' or color 'steps'
      // - Depending on whether the Chroma scale is specified as an array of colors, we pass these as "the" colors to
      //   display; otherwise, we'll depend on calling "colorMap(value)" (chroma.js) to determine the colors
      if (classes) {
        showGradient = false
        values = classes
        // Special case: if we have classes, AND the scale is specified as an array of colors, then we take these
        // as THE "colors" to be displayed by the color legend, so we then bypass "colorMap(value)" for getting the color
        if (scale && Array.isArray(scale)) {
          colors = scale
        }
        // Only one unit, we don't need to convert, return the class values as-is
        if (units.length === 1) {
          unitValues = values
        } else {
          unitValues = values.map(valueMap)
        }
      } else {
        showGradient = true
        values = []
        const dm = colorMap.domain()[0]
        const dd = colorMap.domain()[1] - dm
        for (let i = 0; i < steps; i++) {
          const value = dm + i / (steps - 1) * dd
          values.push(value)
        }
        unitValues = values.map(valueMap)
      }

      return [ showGradient, colors, values, unitValues ]
    },
    getNextUnit (units, currentUnit) {
      // No available units
      if (!units || units.length <= 1 || !currentUnit) return null

      // 'Rotate' from the current unit to the next
      const index = units.findIndex(unit => unit === currentUnit)
      const newIndex = index === -1 ? null : index === units.length - 1 ? 0 : index + 1
      const unit = newIndex === null ? null : units[newIndex]

      return unit
    }
  },
  created () {
    // Load the required components
    this.$options.components['k-color-legend'] = this.$load('KColorLegend')
  },
  mounted () {
    this.resetColorLegend()
    this.$on('layer-shown', this.onColorLegendShowLayer)
    this.$on('layer-hidden', this.onColorLegendHideLayer)
  },
  beforeDestroy () {
    // Delete reference to the legend layer
    this.legendLayer = null
    this.legendEngineLayer = null
    this.resetColorLegend()
    this.$off('layer-shown', this.onColorLegendShowLayer)
    this.$off('layer-hidden', this.onColorLegendHideLayer)
  }
}
