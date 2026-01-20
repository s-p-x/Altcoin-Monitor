// Prisma configuration for Prisma 7
// DATABASE_URL environment variable is read from .env

export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};
