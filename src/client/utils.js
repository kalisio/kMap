// Bind a set of events on given LEaflet object to a vue component
export function bindLeafletEvents (object, events, component) {
  events.forEach(eventName => {
    object.on(eventName, (...args) => {
      component.$emit(eventName, ...args)
    })
  })
}

export function unbindLeafletEvents (object) {
  object.off()
}

export const LeafletEvents = {
  Popup: ['add', 'remove'],
  Tooltip: ['add', 'remove'],
  Layer: ['add', 'remove', 'popupopen', 'popupclose', 'tooltipopen', 'tooltipclose']
}
