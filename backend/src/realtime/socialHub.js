/** @type {import('./socialSocket.js').SocialHub | null} */
let socialHub = null;

/**
 * @param {import('./socialSocket.js').SocialHub} hub
 */
export function setSocialHub(hub) {
  socialHub = hub;
}

/**
 * @returns {import('./socialSocket.js').SocialHub | null}
 */
export function getSocialHub() {
  return socialHub;
}

export function clearSocialHub() {
  socialHub = null;
}
