<template>

  <div class="k-color-legend"
      @click="onClick"
  >
  <q-tooltip v-html="hint"></q-tooltip>

    <div class="k-color-unit"
      :style="colorUnitStyle"
    >
      {{unit}}
    </div>

    <div class="k-color-step"
      v-for="(step, index) in steps" :key="step.value"
      :style="getColorStepStyle(step, index)"
    >
      {{step.value}}
    </div>
  </div>

</template>

<script>
import { QTooltip } from 'quasar'

export default {
  name: 'k-color-legend',
  components: {
    QTooltip
  },
  props: [
    'unit',
    'hint',
    'steps'
  ],
  data () {
    return {
    }
  },
  mounted () {
  },
  beforeDestroy () {
  },
  computed: {
    colorUnitStyle () {
      return {
        width: '100%',
        height: 100 / (this.steps.length + 1) + '%'
      }
    }
  },
  methods: {
    getColorStepStyle (step, index) {
      return {
        width: '100%',
        height: 100 / (this.steps.length + 1) + '%',
        top: (index + 1) * 100 / (this.steps.length + 1) + '%',
        backgroundColor: step.color
      }
    },
    onClick () {
      this.$emit('click', {unit: this.unit})
    }
  }
}
</script>

<style>
  .k-color-legend {
    position: relative;
    cursor: pointer;    
  }

  .k-color-unit {
    position: absolute;
    top: 0;
    background-color: #f2f2f2; /*'#e7e5e5' '#e4e0e0'*/    
    display: flex;
    align-items: center;
    justify-content: center;    
  }

  .k-color-step {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;    
  }
</style>