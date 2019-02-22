import _ from 'lodash'

// Find the nearest time of a given one in a given moment time list
export function getNearestTime (time, times) {
  // Look for the nearest time
  let timeIndex = -1
  let minDiff = Infinity
  times.forEach((currentTime, index) => {
    let diff = Math.abs(time.diff(currentTime))
    if (diff < minDiff) {
      minDiff = diff
      timeIndex = index
    }
  })
  return { index: timeIndex, difference: minDiff }
}

// Find the minimum or maximum time interval in a given moment time list
export function getTimeInterval (times, mode = 'minimum') {
  // Look for the nearest time
  let interval = (mode === 'minimum' ? Infinity : 0)
  times.forEach((currentTime, index) => {
    if (index < (times.length - 1)) {
      let diff = Math.abs(currentTime.diff(times[index + 1]))
      if (mode === 'minimum') {
        if (diff < interval) interval = diff
      } else {
        if (diff > interval) interval = diff
      }
    }
  })
  return interval
}

// Bind a set of events on given Leaflet object to a vue component
export function bindLeafletEvents (object, events, component, options) {
  events.forEach(eventName => {
    object.on(eventName, (...args) => {
      component.$emit(eventName, options, ...args)
    })
  })
}

export function unbindLeafletEvents (object) {
  object.off()
}

export const LeafletEvents = {
  Map: ['baselayerchange', 'overlayadd', 'overlayremove', 'layeradd', 'layerremove', 'zoomlevelschange',
    'resize', 'unload', 'viewreset', 'load', 'zoomstart', 'movestart', 'zoom', 'move', 'zoomend', 'moveend',
    'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove', 'contextmenu',
    'keypress', 'preclick', 'moveend', 'zoomanim', 'fullscreenchange'],
  Popup: ['add', 'remove'],
  Tooltip: ['add', 'remove'],
  Layer: ['add', 'remove', 'popupopen', 'popupclose', 'tooltipopen', 'tooltipclose'],
  Marker: ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'contextmenu',
    'dragstart', 'dragend', 'drag', 'movestart', 'moveend', 'move']
}

export function convertCesiumHandlerEvent(type) {
  const buttonMapping = {
    left: 0,
    middle: 1,
    right: 2
  }
  const buttonMovement = type.split('_')
  const movement = buttonMovement[1].toLowerCase()
  let button = buttonMovement[0].toLowerCase()
  let name
  if (type.startsWith('PINCH')) name = 'pinch'
  else if (type.endsWith('CLICK')) name = 'click'
  else if (type.endsWith('DOUBLE_CLICK')) name = 'dblclick'
  else if (type.startsWith('WHEEL')) name = 'wheel'
  else name = 'mouse'

  if (name === 'mouse') {
    name += movement
    button = buttonMapping[button]
  } else if (event === 'click') {
    button = buttonMapping[button]
  } else if (event === 'pinch') {
    name += movement
    button = undefined
  } else {
    button = 1 // wheel
  }

  return { name, button }
}

export function getHtmlTable(properties) {
  properties = _.pickBy(properties, value => !_.isNil(value))
  const keys = _.keys(properties)
  let html
  if (keys.length === 0) return null
  else if (keys.length === 1) html = _.get(properties, keys[0])
  else {
    const borderStyle = ' style="border: 1px solid black; border-collapse: collapse;"'
    html = '<table' + borderStyle + '>'
    html += '<tr' + borderStyle + '><th' + borderStyle + '>Property</th><th>Value</th></tr>'
    html += keys
      .map(key => '<tr' + borderStyle + '><th' +
        borderStyle + '>' + key + '</th><th>' + _.get(properties, key) + '</th></tr>')
      .join('')
    html += '</table>'
  }
  return html
}