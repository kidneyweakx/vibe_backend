import 'dotenv/config'

export const get_config = () => {
  return {
    R2_ACCESS_KEY: process.env.R2_ACCESS_KEY,
    R2_SECRET_KEY: process.env.R2_SECRET_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTHTOKEN: process.env.TURSO_AUTHTOKEN,
  }
} 