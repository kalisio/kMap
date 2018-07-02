// Hook computing map abilities for a given user
export function defineMapAbilities (subject, can, cannot) {
  // Verification email, reset password, etc.
  can('service', 'geocoder')
  can('create', 'geocoder')
}
