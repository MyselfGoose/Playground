/** When true, session invalidation must not disconnect game sockets (auth recovery). */
let suppressSocketTeardown = false;

export function setSuppressSocketTeardown(value) {
  suppressSocketTeardown = Boolean(value);
}

export function shouldSuppressSocketTeardown() {
  return suppressSocketTeardown;
}
