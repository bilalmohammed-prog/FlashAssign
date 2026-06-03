"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.ApiError = void 0;
exports.mapUnknownError = mapUnknownError;
const zod_1 = require("zod");
class ApiError extends Error {
    constructor(status, code, options = {}) {
        super(options.message ?? code);
        this.name = new.target.name;
        this.status = status;
        this.code = code;
        this.details = options.details;
    }
}
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(options = {}) {
        super(400, "VALIDATION_ERROR", {
            message: options.message ?? "Validation failed",
            details: options.details,
        });
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends ApiError {
    constructor(options = {}) {
        super(401, "UNAUTHORIZED", {
            message: options.message ?? "Unauthorized",
            details: options.details,
        });
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    constructor(options = {}) {
        super(403, "FORBIDDEN", {
            message: options.message ?? "Forbidden",
            details: options.details,
        });
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ApiError {
    constructor(options = {}) {
        super(404, "NOT_FOUND", {
            message: options.message ?? "Not found",
            details: options.details,
        });
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ApiError {
    constructor(options = {}) {
        super(409, "CONFLICT", {
            message: options.message ?? "Conflict",
            details: options.details,
        });
    }
}
exports.ConflictError = ConflictError;
class InternalServerError extends ApiError {
    constructor(options = {}) {
        super(500, "INTERNAL_SERVER_ERROR", {
            message: options.message ?? "Internal Server Error",
            details: options.details,
        });
    }
}
exports.InternalServerError = InternalServerError;
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function mapUnknownError(err) {
    if (err instanceof ApiError) {
        return err;
    }
    if (err instanceof zod_1.ZodError) {
        return new ValidationError({
            message: "Request validation failed",
            details: err.flatten(),
        });
    }
    if (err instanceof SyntaxError) {
        return new ValidationError({ message: "Malformed JSON body" });
    }
    if (isRecord(err)) {
        const message = typeof err.message === "string" ? err.message : undefined;
        const code = typeof err.code === "string" ? err.code : undefined;
        if (code === "23505") {
            return new ConflictError({
                message: message ?? "Resource already exists",
                details: err,
            });
        }
        if (typeof err.status === "number" && typeof code === "string") {
            return new ApiError(err.status, code, {
                message: message ?? code,
                details: err,
            });
        }
        if (message) {
            return new InternalServerError({ message });
        }
    }
    if (err instanceof Error) {
        return new InternalServerError({ message: err.message });
    }
    return new InternalServerError();
}
