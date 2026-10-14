export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field?: string; reason?: string }>;
  correlation_id?: string;
  status: number;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    correlation_id: string;
    timestamp?: string;
    api_version?: string;
  };
}

let authToken: string | null = localStorage.getItem('apnileap-token');

export function setApiAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('apnileap-token', token);
  } else {
    localStorage.removeItem('apnileap-token');
  }
}

export function getApiAuthToken(): string | null {
  return authToken;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'corr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const correlationId = generateUUID();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    ...(options.headers as Record<string, string> || {})
  };

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers
    });
  } catch (err: any) {
    const networkError: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to ApniLeap service. Please check your connection.',
      status: 0,
      correlation_id: correlationId
    };
    throw networkError;
  }

  // Handle 401 Unauthorized — attempt token refresh
  if (response.status === 401 && !endpoint.includes('/session') && !endpoint.includes('/refresh')) {
    try {
      const refreshRes = await fetch('/api/v1/ui/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (refreshRes.ok) {
        const refreshData = (await refreshRes.json()) as any;
        const newToken = refreshData.data?.token;
        if (newToken) {
          setApiAuthToken(newToken);
          headers['Authorization'] = `Bearer ${newToken}`;
          // Retry original request once
          response = await fetch(endpoint, { ...options, headers });
        }
      } else {
        setApiAuthToken(null);
        window.dispatchEvent(new CustomEvent('apnileap-session-expired'));
      }
    } catch {
      setApiAuthToken(null);
      window.dispatchEvent(new CustomEvent('apnileap-session-expired'));
    }
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData: any = null;

  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorPayload = responseData?.error;
    const apiError: ApiError = {
      code: errorPayload?.code || (response.status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR'),
      message: errorPayload?.message || `Request failed with status ${response.status}`,
      details: errorPayload?.details,
      correlation_id: responseData?.meta?.correlation_id || correlationId,
      status: response.status
    };
    throw apiError;
  }

  // Return data payload from standard envelope if present, else raw
  return (responseData?.data !== undefined ? responseData.data : responseData) as T;
}
