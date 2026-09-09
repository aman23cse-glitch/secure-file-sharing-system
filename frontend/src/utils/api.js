/**
 * Multi-Node API Client (Supports Direct Cloud and Edge Gateway Routing)
 */

export const CLOUD_BASE_URL = 'http://localhost:5000';
export const EDGE_BASE_URL = 'http://localhost:5001';

// Default active route: 'EDGE' or 'CLOUD'
let activeRoute = 'EDGE';

export function getActiveRoute() {
  return activeRoute;
}

export function setActiveRoute(route) {
  activeRoute = route;
}

export function getBaseUrl(overrideRoute = null) {
  const route = overrideRoute || activeRoute;
  return route === 'EDGE' ? EDGE_BASE_URL : CLOUD_BASE_URL;
}

export function getAuthToken() {
  return localStorage.getItem('sec_edge_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('sec_edge_token', token);
  } else {
    localStorage.removeItem('sec_edge_token');
  }
}

export function getAuthUser() {
  const user = localStorage.getItem('sec_edge_user');
  return user ? JSON.parse(user) : null;
}

export function setAuthUser(user) {
  if (user) {
    localStorage.setItem('sec_edge_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sec_edge_user');
  }
}

/**
 * Standard fetch with auth token and latency benchmarking
 */
export async function apiRequest(endpoint, options = {}, overrideRoute = null) {
  const startTime = performance.now();
  const baseUrl = getBaseUrl(overrideRoute);
  const url = `${baseUrl}${endpoint}`;

  const headers = {
    ...options.headers
  };

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.blob();
    }

    if (!response.ok) {
      const errorMsg = data && data.error ? data.error : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return {
      data,
      headers: response.headers,
      status: response.status,
      latencyMs: elapsedMs,
      routeUsed: overrideRoute || activeRoute,
      serverNode: baseUrl
    };
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startTime);
    err.latencyMs = elapsedMs;
    err.routeUsed = overrideRoute || activeRoute;
    throw err;
  }
}
