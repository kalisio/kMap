<template>
  <q-toolbar class="k-navigation-bar q-pa-sm" :style="width()">
    <!-- 
      Before section
    -->
    <k-tool-bar :actions="navigationBar.beforeActions" />
    <!--
      The location input
    -->
    <template v-if="navigationBar.locationInput">
      <div style="width: 70%">
        <k-location-input :location-map="null" :dense="true" @input="onLocationChanged" />
      </div>
      <q-separator vertical inset />
    </template>
    <!--
      After section
    -->
    <q-space />
    <k-tool-bar :actions="navigationBar.afterActions" />
  </q-toolbar>
</template>

<script>
export default {
  name: 'k-navigation-bar',
  data () {
    return {
      navigationBar: this.$store.get('navigationBar')
    }
  },
  methods: {
    width () {
      if (this.$q.screen.lt.xs) return 'width: 100vw'
      return 'width: 95vw'
    },
    onLocationChanged (location) {
      if (location) this.$emit('location-changed', location)
    }
  },
  created () {
    this.$options.components['k-tool-bar'] = this.$load('layout/KToolBar')
    this.$options.components['k-location-input'] = this.$load('KLocationInput')
  }
}
</script>

<style lang="stylus">
.k-navigation-bar {
  border: solid 1px lightgrey;
  border-radius: 8px;
  background: #ffffff
}

.k-navigation-bar:hover {
  border: solid 2px $primary;
}
</style>