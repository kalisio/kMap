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
    setSelectableLevels (layer, levels, initialLevel = undefined) {
      this.selectableLevels = levels
      this.selectableLevelsLayer = layer
      if (initialLevel === undefined) {
        initialLevel = _.get(levels, 'values[0]')
        if (initialLevel === undefined) { initialLevel = _.get(levels, 'range.min') }
      }
      this.setSelectedLevel(initialLevel)
    },
    clearSelectableLevels (layer) {
      if (this.selectableLevelsLayer && (this.selectableLevelsLayer._id === layer._id)) {
        this.selectedLevel = 0
        this.selectableLevels = {}
        this.selectableLevelsLayer = null
        // level slider was associated with given layer
        return true
      }

      // level slider wasn't associated with given layer
      return false
    },
    setSelectedLevel (level) {
      this.selectedLevel = level
      this.$emit('selected-level-changed', level)
    }
  }
}
