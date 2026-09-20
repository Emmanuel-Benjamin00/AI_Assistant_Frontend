/**
 * Why the first request can be slow. The API runs on Azure's free tier, which stops the app
 * when it is idle, so the next request has to start it again.
 */
export const COLD_START_NOTE =
  'The API is hosted on a free Azure plan that sleeps when idle, so the first request after a ' +
  'pause takes a minute or two to start it up.'
