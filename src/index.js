import makeDebug from 'debug'
import services from './services'
// We faced a bug in babel so that transform-runtime with export * from 'x' generates import statements in transpiled code
// Tracked here : https://github.com/babel/babel/issues/2877
// We tested the workaround given here https://github.com/babel/babel/issues/2877#issuecomment-270700000 with success so far
export * from './services'
export * as hooks from './hooks'
export * from './marshall'
export * from './common'

const debug = makeDebug('kalisio:kMap')

export default function init () {
  const app = this

  debug('Initializing kalisio map')

  app.configure(services)
}
