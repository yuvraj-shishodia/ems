export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "EMS",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Check your connection and try again.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed. Try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}
