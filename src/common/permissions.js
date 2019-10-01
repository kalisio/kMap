// Hook computing map abilities for a given user
export function defineUserAbilities (subject, can, cannot) {
  can('service', 'geocoder')
  can('create', 'geocoder')
  can('service', 'catalog')
  can('all', 'catalog')
  can('service', 'geoalerts')
  can('all', 'geoalerts')
}
