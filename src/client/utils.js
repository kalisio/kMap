export * from './leaflet/utils'
export * from './cesium/utils'

export async function fetchGeoJson (dataSource) {
  const response = await fetch(dataSource)
  if (response.status !== 200) {
    throw new Error(`Impossible to fetch ${dataSource}: ` + response.status)
  }
  const data = await response.json()
  return data
}

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

// Format (reverse) geocoding output
export function formatGeocodingResult (element) {
  let label = element.formattedAddress || ''
  if (!label) {
    if (element.streetNumber) label += (element.streetNumber + ', ')
    if (element.streetName) label += (element.streetName + ' ')
    if (element.city) label += (element.city + ' ')
    if (element.zipcode) label += (' (' + element.zipcode + ')')
  }
  return label
}
