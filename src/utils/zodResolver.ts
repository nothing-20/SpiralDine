import { ZodSchema } from 'zod';

/**
 * A lightweight custom Zod resolver for React Hook Form.
 * Safe diagnostics only: Never logs sensitive input values or data payloads.
 */
export const zodResolver = (schema: ZodSchema<any>) => async (values: any) => {
  try {
    const data = schema.parse(values);
    return {
      values: data,
      errors: {},
    };
  } catch (error: any) {
    const errorList = error.errors || [];
    const errors = errorList.reduce((acc: any, current: any) => {
      const fieldPath = current.path.join('.');
      acc[fieldPath] = {
        message: current.message,
        type: current.code || 'validation',
      };
      return acc;
    }, {});

    return {
      values: {},
      errors,
    };
  }
};
export default zodResolver;
