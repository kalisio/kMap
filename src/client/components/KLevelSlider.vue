<template>
  <div v-if="isVisible">
    <vue-slider class="text-primary"
      v-model="kActivity.selectedLevel"
      :direction="'btt'"
      :height="100"
      :width="4"
      :lazy="kActivity.selectableLevels.lazy"
      :marks="true"
      :hide-label="true"
      :data="kActivity.selectableLevels.values"
      :tooltip="'focus'"
      :tooltip-formatter="getFormatedLevel"
      @change="onLevelChanged"
    />
    <p class="text-secondary text-caption" style="transform: rotate(-90deg) translateX(24px);">
      <b>{{$t(kActivity.selectableLevels.label)}} - {{getFormatedLevel(kActivity.selectedLevel)}}</b>
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
  computed: {
    hasLevels () { return _.get(this.kActivity.selectableLevels, 'values', []).length > 0 },
    isVisible () { return this.hasLevels }
  },
  methods: {
    setLevel (value) {
      this.kActivity.selectedLevel = value
      this.$emit('selected-level-changed', this.kActivity.selectedLevel)
    },
    onLevelChanged (level) {
      this.setLevel(level)
    },
    getFormatedLevel (level) {
      const unit = _.get(this.kActivity.selectableLevels, 'units[0]')
      return `${level || this.kActivity.selectedLevel} ${unit}`
    }
  }
}
</script>

<style lang="stylus">
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
</style>
