import { z } from "zod";
import {
  isoDateStringSchema,
  nonEmptyStringSchema,
  normalizeTaskStatusInput,
  optionalTextSchema,
  taskStatusInputSchema,
  uuidSchema,
} from "./common";

export const taskCreateSchema = z
  .object({
    title: nonEmptyStringSchema,
    description: optionalTextSchema.optional(),
    due_date: isoDateStringSchema.optional(),
    project_id: uuidSchema.optional(),
    user_id: uuidSchema,
  })
  .strict();

export const taskUpdateSchema = z
  .object({
    title: nonEmptyStringSchema.optional(),
    description: optionalTextSchema.optional(),
    dueDate: isoDateStringSchema.optional(),
    status: taskStatusInputSchema.optional(),
    project_id: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

export const taskIdParamsSchema = z
  .object({
    taskId: uuidSchema,
  })
  .strict();

export function normalizeTaskUpdateStatus(status?: z.infer<typeof taskStatusInputSchema>) {
  return status ? normalizeTaskStatusInput(status) : undefined;
}

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
