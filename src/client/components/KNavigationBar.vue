<template>
  <q-toolbar class="k-navigation-bar">
    <!-- 
      Before section
    -->
    <k-tool-bar :actions="navigationBar.actions.before" />
    <!--
      The location input
    -->
    <div v-if="navigationBar.locationInput" style="width: 50vw;">
      <k-location-input :location-map="null" :dense="true" @input="onLocationChanged" />
    </div>
    <!--
      After section
    -->
    <k-tool-bar :actions="navigationBar.actions.after" />
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
  border: solid 1px $primary;
}
</style>