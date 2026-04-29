import { NextResponse } from 'next/server';

/**
 * Create a JSON response with caching headers for API endpoints
 * @param data The data to return
 * @param cacheSeconds How long to cache (in seconds). Default 60.
 * @param status HTTP status code
 */
export function cachedJsonResponse(
  data: any,
  cacheSeconds: number = 60,
  status: number = 200
) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  });
}

/**
 * Create an error JSON response
 * @param error Error message or object
 * @param status HTTP status code
 */
export function errorJsonResponse(error: any, status: number = 500) {
  const errorData = {
    success: false,
    error: error instanceof Error ? error.message : error
  };
  
  return new NextResponse(JSON.stringify(errorData), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Don't cache errors aggressively
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

/**
 * Add proper cache headers to response
 */
export function withCacheHeaders(response: NextResponse, cacheSeconds: number = 60) {
  response.headers.set('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
  return response;
}
