/** @type {{ redisConnected: boolean, instanceCount: number, bootedAt: string, bootId: string }} */
let runtimeContext = {
  redisConnected: false,
  instanceCount: 1,
  bootedAt: new Date().toISOString(),
  bootId: `boot-${Date.now()}`,
};

/**
 * @param {{ redisConnected?: boolean, instanceCount?: number, bootedAt?: string, bootId?: string }} ctx
 */
export function setAdminRuntimeContext(ctx) {
  runtimeContext = { ...runtimeContext, ...ctx };
}

export function getAdminRuntimeContext() {
  return { ...runtimeContext };
}
