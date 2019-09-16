<template>
  <div class="row items-center k-navigation-bar no-wrap" :style="navBarStyle()">
    <!-- 
      Before section
    -->
    <template v-if="mode=='toolbar'">
      <k-tool-bar :actions="navigationBar.actions.before" />
    </template>
    <!--
      The location input
    -->
    <template v-if="navigationBar.locationInput">
      <q-btn v-if="mode=='searchbar'" icon="arrow_back" color="primary" round flat @click="mode='toolbar'" >
        <q-tooltip>{{ $t('KNavigationBar.BACK') }}</q-tooltip>
      </q-btn>
      <k-location-input
        :class="(mode === 'searchbar' || !$q.screen.lt.md) ? 'full-width q-pr-sm' : ''"
        :user="mode === 'toolbar'"
        :map="null" 
        :search="mode === 'searchbar' || (mode === 'toolbar' && !$q.screen.lt.md)"
        :dense="true" 
        :style=""
        @input="onLocationChanged" />
      <q-btn v-if="mode=='toolbar' && $q.screen.lt.md" icon="search" color="primary" round flat @click="mode='searchbar'" >
        <q-tooltip>{{ $t('KNavigationBar.SEARCH') }}</q-tooltip>
      </q-btn>
    </template>
    <!--
      After section
    -->
    <template v-if="mode=='toolbar'">
      <k-tool-bar :actions="navigationBar.actions.after" />
    </template>
  </div>
</template>

<script>
export default {
  name: 'k-navigation-bar',
  data () {
    return {
      navigationBar: this.$store.get('navigationBar'),
      mode: 'toolbar'
    }
  },
  methods: {
    navBarStyle() {
      if (this.$q.screen.lt.md) return ''
      else return 'width: 80vw'
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
  border: solid 1px $primary;
}
</style>