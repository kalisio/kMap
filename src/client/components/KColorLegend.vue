<template>

  <div class="k-legend"
      ref="legend"
      @click="onClick"
  >
    <q-resize-observable @resize="onResize" />  

    <q-tooltip v-show="hint" v-html="hint"></q-tooltip>

    <div class="k-unit"
      :style="colorUnitStyle"
    >
      {{unit}}
    </div>

    <span class="k-grad-step"
      v-for="step in steps" :key="'step'+step"
      :style="getStepStyle(step)"
    >
    </span>

    <div class="k-value-step"
      v-for="(value, index) in values" :key="index"
      :style="getValueStyle(value, index)"
    >
      {{value}}
    </div>
  </div>

</template>

<script>
const STEPS = 100

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
    'values',
    'showGradient'
  ],
  data () {
    return {
      componentHeight: 0,
      dm: this.colorMap.domain()[0],
      dd: this.colorMap.domain()[1] - this.colorMap.domain()[0]
    }
  },
  mounted () {
    this.updateComponentDimensions()
  },
  beforeDestroy () {
  },
  computed: {
    colorUnitHeight () {
      return this.componentHeight / (this.values.length + 1)  // + 1: the unit itself is an extra "box"
    },
    // Height of the legend WITHOUT the unit
    colorLegendHeight () {
      return this.componentHeight - this.colorUnitHeight
    },
    steps () {
      return this.showGradient ? Math.trunc(this.colorLegendHeight) : 0   
    },
    stepValue () {
      return this.dd / this.colorLegendHeight
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
    getValueStyle (value, index) {
      let css = {
        width: '100%',
        height: 100 / (this.values.length + 1) + '%',
        top: (index + 1) * 100 / (this.values.length + 1) + '%'  // index + 1: the unit itself is an extra "box"
      }

      if (!this.showGradient) {
        css.backgroundColor = this.colorMap(value)
      }

      return css
    },
    getStepStyle (step) {
      const value = this.dm + (step-1) * this.stepValue

      return {
        top: step-1 + this.colorUnitHeight + 'px',
        backgroundColor: this.colorMap(value)
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

  .k-unit {
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

  .k-grad-step {
    position: absolute;
    display: inline-block;
    width: 100%;
    height: 1px;
  }
</style>