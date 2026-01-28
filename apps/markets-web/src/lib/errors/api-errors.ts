/**
 * Base API Error class
 * All custom API errors should extend this class
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 400 Bad Request - Invalid input or business rule violation
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "NotFoundError";
  }
}

/**
 * 409 Conflict - Resource state conflict
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message);
    this.name = "ConflictError";
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export class ValidationError extends ApiError {
  constructor(details: unknown) {
    super(422, "Validation failed", details);
    this.name = "ValidationError";
  }
}

/**
 * 429 Too Many Requests - Rate limiting
 */
export class RateLimitError extends ApiError {
  constructor(message = "Too many requests") {
    super(429, message);
    this.name = "RateLimitError";
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalError extends ApiError {
  constructor(message = "Internal server error") {
    super(500, message);
    this.name = "InternalError";
  }
}
