import * as Joi from 'joi';

export const validationSchema = Joi.object({
  APP_NAME: Joi.string().default('workflow-api'),

  PORT: Joi.number().port().default(3000),

  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
});
