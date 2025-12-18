// src/lib/api-errors.ts
// Centralized API error handling utilities

import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: unknown;
}

/**
 * Standard API error response creator
 */
export function apiError(
    message: string,
    status: number = 500,
    code?: string,
    details?: unknown
): NextResponse<ApiErrorResponse> {
    const body: ApiErrorResponse = { error: message };
    if (code) body.code = code;
    if (details) body.details = details;

    console.error(`[API Error] ${status}: ${message}`, details || '');

    return NextResponse.json(body, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
    unauthorized: () => apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    forbidden: () => apiError('Forbidden', 403, 'FORBIDDEN'),
    notFound: (resource: string = 'Resource') => apiError(`${resource} not found`, 404, 'NOT_FOUND'),
    badRequest: (message: string) => apiError(message, 400, 'BAD_REQUEST'),
    internalError: (message: string = 'Internal server error') => apiError(message, 500, 'INTERNAL_ERROR'),
    rateLimited: () => apiError('Too many requests', 429, 'RATE_LIMITED'),
    serviceUnavailable: () => apiError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE'),
};

/**
 * Wrap an async API handler with standardized error handling
 */
export function withErrorHandling<T>(
    handler: (request: Request) => Promise<NextResponse<T>>
) {
    return async (request: Request): Promise<NextResponse<T | ApiErrorResponse>> => {
        try {
            return await handler(request);
        } catch (error) {
            if (error instanceof Error) {
                return apiError(error.message);
            }
            return apiError('An unexpected error occurred');
        }
    };
}

/**
 * Client-side API error handler
 * Use this in frontend components to handle API responses
 */
export async function handleApiResponse<T>(
    response: Response,
    onError?: (error: ApiErrorResponse) => void
): Promise<T | null> {
    if (!response.ok) {
        try {
            const errorData: ApiErrorResponse = await response.json();
            if (onError) {
                onError(errorData);
            } else {
                console.error('[API] Error:', errorData.error);
            }
            return null;
        } catch {
            if (onError) {
                onError({ error: `HTTP ${response.status}: ${response.statusText}` });
            }
            return null;
        }
    }

    try {
        return await response.json() as T;
    } catch {
        if (onError) {
            onError({ error: 'Failed to parse response' });
        }
        return null;
    }
}
