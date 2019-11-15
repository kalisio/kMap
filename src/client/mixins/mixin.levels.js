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
    createLevelSlider () {
      if (this.levelSlider) return
      const Component = Vue.extend(KLevelSilder)
      this.levelSlider = new Component({
        propsData: {
          level:  this.selectedLevel,
          levels: this.selectableLevels
        }
      })
    },
    removeLevelSlider () {
      if (!this.levelSlider) return
      this.levelSlider = null
    },
    setSelectableLevels (layer, levels) {
      this.selectableLevels = levels
      this.selectableLevelsLayer = layer
    },
    clearSelectableLevels (layer) {
      if (this.selectableLevelsLayer && (this.selectableLevelsLayer._id === layer._id)) {
        this.selectedLevel = 0
        this.selectableLevels = []
        this.selectableLevelsLayer = null
      }
    }
  },
  beforeCreate () {
  },
  mounted () {
  },
  beforeDestroy () {
  }
}
