<template>

  <div class="k-legend"
      ref="legend"
      @click="onClick"
  >
    <q-resize-observable @resize="onResize" />  

    <q-tooltip v-show="hint" v-html="hint"></q-tooltip>

    <div class="k-unit-box"
      :style="colorUnitStyle"
    >
      {{unit}}
    </div>

    <span class="k-gradient-step"
      v-for="gradientStep in gradientSteps" :key="'step'+gradientStep"
      :style="getGradientStepStyle(gradientStep)"
    >
    </span>

    <div class="k-value-step"
      v-for="(unitValue, index) in unitValues" :key="index"
      :style="getUnitValueStyle(index)"
    >
      {{unitValue}}
    </div>
  </div>

</template>

<script>
import { QResizeObservable, QTooltip } from 'quasar'

export default {
  name: 'k-color-legend',
  components: {
    QResizeObservable,
    QTooltip
  },
  props: [
    'unit',
    'hint',
    'colorMap',
    'colors',
    'values',
    'unitValues',
    'showGradient'
  ],
  data () {
    return {
      componentHeight: 0,
      domainStart: this.colorMap.domain()[0],
      domainRange: this.colorMap.domain()[1] - this.colorMap.domain()[0],
      invert: this.values[0] < this.values[this.values.length-1]
    }
  },
  mounted () {
    this.updateComponentDimensions()
  },
  beforeDestroy () {
  },
  computed: {
    // Height of the unit box (in pixels)
    colorUnitHeight () {
      return this.componentHeight / (this.values.length + 1)  // + 1: the unit itself is an extra "box"
    },
    // Height of the legend (in pixels) WITHOUT the unit box
    colorLegendHeight () {
      return this.componentHeight - this.colorUnitHeight
    },
    // This is a number (the number of gradient steps) used in the Vue "v-for" clause - it must be an integer!
    gradientSteps () {
      // If we're not showing a gradient then return zero for the gradient steps,
      // otherwise use Math.trunc() to make it an integer
      return this.showGradient ? Math.trunc(this.colorLegendHeight) : 0
    },
    gradientStepValue () {
      return this.domainRange / this.colorLegendHeight
    },
    colorUnitStyle () {
      return {
        width: '100%',
        height: this.colorUnitHeight + 'px'
      }
    }
  },
  methods: {
    onResize (size) {
      this.updateComponentDimensions()
    },
    updateComponentDimensions () {
      const componentRef = this.$refs.legend

      if (componentRef) {
        const componentRect = componentRef.getBoundingClientRect()

        this.componentHeight = componentRect.height
      }
    },
    getUnitValueStyle (index) {
      let height = this.colorLegendHeight / this.values.length

      let top = index * height

      // invert: calculate placement from the bottom of the legend
      if (this.invert) {
        top = this.colorLegendHeight - top

      // offset it from the color unit box
      } else {
        top = this.colorUnitHeight + top
      }

      let css = {
        width: '100%',
        height: height + 'px',
        top: top + 'px',
      }

      if (!this.showGradient) {
        css.backgroundColor = this.colors ? this.colors[index] : this.colorMap(this.values[index])
      }

      return css
    },
    getGradientStepStyle (gradientStep) {
      let top = gradientStep

      // invert: calculate placement from the bottom of the legend
      if (this.invert) {
        top = this.colorLegendHeight - top
      }

      // offset it from the color unit box
      top = this.colorUnitHeight + top

      // calculate the domain value at this gradient step
      const domainValue = this.domainStart + (gradientStep - 1) * this.gradientStepValue

      return {
        width: '100%',
        height: '1px',
        top: top + 'px',
        backgroundColor: this.colorMap(domainValue)
      }
    },
    onClick () {
      this.$emit('click', {unit: this.unit})
    }
  }
}
</script>

<style>
  .k-legend {
    position: relative;
    cursor: pointer;    
  }

  .k-unit-box {
    position: absolute;
    top: 0;
    background-color: #f2f2f2;
    display: flex;
    align-items: center;
    justify-content: center;    
  }

  .k-value-step {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border-color: #f2f2f2; 
  }

  .k-gradient-step {
    position: absolute;
    display: inline-block;
  }
</style>