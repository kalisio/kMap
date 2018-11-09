// Hook computing map abilities for a given user
export function defineUserAbilities (subject, can, cannot) {
  // Verification email, reset password, etc.
  can('service', 'geocoder')
  can('create', 'geocoder')
  can('service', 'layers')
  can('all', 'layers')
}
