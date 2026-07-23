export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'workflow-api',
    port: parseInt(process.env.PORT ?? '3000', 10),
    environment: process.env.NODE_ENV ?? 'development',
  },
});
