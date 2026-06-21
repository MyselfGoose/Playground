/** @type {{ redisConnected: boolean, instanceCount: number }} */
let runtimeContext = {
  redisConnected: false,
  instanceCount: 1,
};

/**
 * @param {{ redisConnected?: boolean, instanceCount?: number }} ctx
 */
export function setAdminRuntimeContext(ctx) {
  runtimeContext = { ...runtimeContext, ...ctx };
}

export function getAdminRuntimeContext() {
  return { ...runtimeContext };
}
