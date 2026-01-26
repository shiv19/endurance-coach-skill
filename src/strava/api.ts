import type { Tokens } from "../lib/config.js";
import { log } from "../lib/logging.js";
import type { StravaActivity, StravaAthlete, StravaDetailedActivity } from "./types.js";

const API_BASE = "https://www.strava.com/api/v3";

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") || "60");
    log.warn(`Rate limited. Waiting ${retryAfter}s...`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchWithRetry(url, options, retries);
  }

  if (!response.ok && retries > 0) {
    log.warn(`Request failed (${response.status}), retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetchWithRetry(url, options, retries - 1);
  }

  return response;
}

export async function getAthlete(tokens: Tokens): Promise<StravaAthlete> {
  const response = await fetchWithRetry(`${API_BASE}/athlete`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch athlete: ${response.statusText}`);
  }

  return response.json();
}

export async function getActivities(
  tokens: Tokens,
  after: number,
  before?: number,
  page = 1,
  perPage = 100
): Promise<StravaActivity[]> {
  const url = new URL(`${API_BASE}/athlete/activities`);
  url.searchParams.set("after", after.toString());
  if (before) {
    url.searchParams.set("before", before.toString());
  }
  url.searchParams.set("page", page.toString());
  url.searchParams.set("per_page", perPage.toString());

  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.statusText}`);
  }

  return response.json();
}

export async function getActivityDetails(
  tokens: Tokens,
  id: number,
  includeAllEfforts?: boolean
): Promise<StravaDetailedActivity> {
  const url = new URL(`${API_BASE}/activities/${id}`);
  if (includeAllEfforts) {
    url.searchParams.set("include_all_efforts", "true");
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity details: ${response.statusText}`);
  }

  return response.json();
}

export async function getAllActivities(tokens: Tokens, afterDate: Date): Promise<StravaActivity[]> {
  const after = Math.floor(afterDate.getTime() / 1000);
  const activities: StravaActivity[] = [];
  let page = 1;
  const perPage = 100;

  log.start(`Fetching activities since ${afterDate.toISOString().split("T")[0]}...`);

  while (true) {
    const batch = await getActivities(tokens, after, undefined, page, perPage);
    activities.push(...batch);

    log.progress(`   Fetched ${activities.length} activities...`);

    if (batch.length < perPage) {
      break;
    }

    page++;
    // Small delay to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log.progressEnd();
  log.success(`Fetched ${activities.length} activities total`);
  return activities;
}
