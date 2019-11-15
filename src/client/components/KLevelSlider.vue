<template>
  <div v-if="isVisible" class="k-level-slider">
    <vue-slider class="text-primary"
      v-model="level"
      :direction="'btt'"
      :height="100"
      :width="4"
      :lazy="levels.lazy"
      :marks="true"
      :hide-label="true"
      :data="levels.values"
      :tooltip="'focus'"
      :tooltip-formatter="getFormatedLevel"
      @change="onLevelChanged"
    />
    <p class="text-secondary text-caption" style="transform: rotate(-90deg) translateX(24px);">
      <b>{{$t(levels.label)}} - {{getFormatedLevel(level)}}</b>
    </p>
  </div>
</template>

<script>
import _ from 'lodash'
import VueSlider from 'vue-slider-component'
import 'vue-slider-component/theme/material.css'

export default {
  name: 'k-level-slider',
  inject: ['kActivity'],
  components: {
    VueSlider
  },
  props: {
    level:  { type: Number, default: 0 },
    levels: { type: Object, default: () => { lazy: true } }
  },
  computed: {
    hasLevels () { return _.get(this.levels, 'values', []).length > 0 },
    isVisible () { return this.hasLevels() }
  },
  methods: {
    setLevel (value) {
      this.level = value
      this.$emit('level-changed', this.level)
    },
    onLevelChanged (level) {
      this.setLevel (level)
    },
    getFormatedLevel (level) {
      const unit = _.get(this.levels, 'units[0]')
      return `${level || this.level} ${unit}`
    }
  },
  mounted () {
  },
  beforeDestroy () {
  }
}
</script>

<style>
/*
.vue-slider-rail
  background-color: $secondary;

.vue-slider-disabled .vue-slider-rail
  background-color: $secondary;

.vue-slider-process
  background-color: $secondary;

.vue-slider-dot-handle
  background-color: $secondary;

.vue-slider-dot-handle::after
  background-color: transparentify($secondary, #000);

.vue-slider-dot-tooltip-inner
  background-color: transparentify($secondary, #000);

.vue-slider-dot-tooltip-text
  width: 60px;
  height: 60px;
  font-size: 1em;

.vue-slider-mark-step
  background-color: $primary;

.vue-slider-mark-step-active
  background-color: $primary;
*/
</style>
