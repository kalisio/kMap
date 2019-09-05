<template>

  <div class="k-legend shadow-2"
      ref="legend"
      @click="onClick"
  >
    <q-resize-observer @resize="onResize" />

    <span class="k-unit-box bg-secondary text-white text-caption"
      :style="colorUnitStyle"
    >
      {{unit}}
      <q-tooltip anchor="top middle" self="bottom middle" :offset="[10, 20]" v-show="hint">{{hint}}</q-tooltip>
    </span>

    <span class="k-gradient-step"
      v-for="gradientStep in gradientSteps" :key="'step'+gradientStep"
      :style="getGradientStepStyle(gradientStep)"
    >
    </span>

    <span class="k-value-step text-white"
      v-for="(unitValue, index) in unitValues" :key="index"
      :style="getUnitValueStyle(index)"
    >
      {{unitValue}}
    </span>
  </div>

</template>

<script>
export default {
  name: 'k-color-legend',
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
      invert: this.values[0] < this.values[this.values.length - 1]
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
      return this.componentHeight / (this.values.length + 1) // + 1: the unit itself is an extra "box"
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
      const height = this.colorLegendHeight / this.values.length

      let top = index * height

      // invert: calculate placement from the bottom of the legend
      if (this.invert) {
        top = this.colorLegendHeight - top

      // offset it from the color unit box
      } else {
        top = this.colorUnitHeight + top
      }

      const css = {
        width: '100%',
        height: height + 'px',
        top: top + 'px',
        'text-shadow': '1px 1px 2px black'
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
      this.$emit('click', { unit: this.unit })
    }
  }
}
</script>

<style lang="stylus">
.k-legend
  position: relative;
  cursor: pointer;
  border: none

.k-unit-box
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;

.k-value-step
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;

.k-gradient-step
  position: absolute;
  display: inline-block;
</style>
