import bcrypt from 'bcrypt';

/**
 * @param {{ bcryptCost: number }} opts
 */
export function createPasswordService({ bcryptCost }) {
  return {
    /**
     * @param {string} plain
     */
    async hash(plain) {
      return bcrypt.hash(plain, bcryptCost);
    },
    /**
     * @param {string} plain
     * @param {string} hash
     */
    async verify(plain, hash) {
      return bcrypt.compare(plain, hash);
    },
  };
}
