import _ from 'lodash'
import Vue from 'vue'
import KLevelSlider from '../components/KLevelSlider.vue'

export default {
  data () {
    return {
      selectedLevel: 0,
      selectableLevels: {}
    }
  },
  methods: {
    setSelectableLevels (layer, levels, initialLevel) {
      this.selectedLevel = initialLevel
      this.selectableLevels = levels
      this.selectableLevelsLayer = layer
      this.$emit('selected-level-changed', this.selectedLevel)
      // this.slider.setLevel(this.selectedLevel)
    },
    clearSelectableLevels (layer) {
      if (this.selectableLevelsLayer && (this.selectableLevelsLayer._id === layer._id)) {
        this.selectedLevel = 0
        this.selectableLevels = {}
        this.selectableLevelsLayer = null
      }
    }
  }
}
