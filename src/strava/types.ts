export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  weight?: number;
  ftp?: number;
}

export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete: StravaAthlete;
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  max_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
  average_cadence?: number;
  calories?: number;
  description?: string;
  workout_type?: number;
  gear_id?: string;
}

export interface StravaStream {
  type: string;
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface MetaAthlete {
  id: number;
  resource_state: number;
}

export interface MetaActivity {
  id: number;
  resource_state: number;
}

export interface Lap {
  id: number;
  resource_state: number;
  name: string;
  activity: MetaActivity;
  athlete: MetaAthlete;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_cadence: number;
  device_watts: boolean;
  average_watts: number;
  lap_index: number;
  split: number;
}
