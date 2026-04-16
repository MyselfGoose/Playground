# MongoDB connection guide

## Connection string shape

The backend reads **`MONGO_URI`** (same variable Mongoose uses). A typical URI looks like:

```text
mongodb+srv://USERNAME:PASSWORD@CLUSTER_HOST/DATABASE_NAME?retryWrites=true&w=majority
```

or for a local server:

```text
mongodb://127.0.0.1:27017/games_platform
```

### Parts (conceptual)

| Segment | Meaning |
|---------|---------|
| Scheme | `mongodb://` (single host) or `mongodb+srv://` (Atlas SRV lookup) |
| `USERNAME` / `PASSWORD` | Database user credentials (**URL-encode** special characters in the password, e.g. `@` → `%40`) |
| `CLUSTER_HOST` | Hostname(s) of the deployment |
| `DATABASE_NAME` | Logical database name (collections live inside it) |
| Query options | e.g. `retryWrites`, TLS parameters, `authSource` if credentials live in `admin` |

**Security:** never commit real URIs with passwords. Use `.env` locally and a secret manager in production.

---

## MongoDB Atlas (hosted)

1. Create a free cluster at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database Access → create a database user (username + strong password).
3. Network Access → add your IP (or `0.0.0.0/0` for quick dev only — not recommended for production).
4. Clusters → **Connect** → Drivers → copy the connection string.
5. Replace `<password>` with the URL-encoded password and set:

```bash
MONGO_URI='mongodb+srv://USER:ENCODED_PASSWORD@cluster0.xxxxx.mongodb.net/games_platform?retryWrites=true&w=majority'
```

6. Start the API (`npm run dev`) and confirm logs show `mongodb_connected`.

---

## MongoDB Compass (GUI)

1. Install [MongoDB Compass](https://www.mongodb.com/products/compass).
2. Paste the same `MONGO_URI` into the connection field.
3. Connect — you should see the `games_platform` database (or whatever name you chose) and collections such as `users` and `refreshesessions` (Mongoose default plural of `RefreshSession`) after using the API or seed script.

Compass is useful to inspect indexes, documents, and TTL behaviour for `RefreshSession`.

---

## Local Docker (example)

```bash
docker run -d --name games-mongo -p 27017:27017 mongo:7
```

Then:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/games_platform
```

---

## TTL on refresh sessions

`RefreshSession` defines a TTL index on `expiresAt` so MongoDB can automatically delete expired session documents after they are no longer valid. Revoked rows may remain until expiry unless you add separate cleanup jobs later.
