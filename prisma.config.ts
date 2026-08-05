import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: "postgresql://postgres:postgres@127.0.0.1:5433/workflow_db?schema=public",
  },
})
