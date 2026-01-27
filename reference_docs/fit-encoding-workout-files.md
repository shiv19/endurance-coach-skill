# Encoding FIT Workout Files Summary

Source: [Garmin Encoding Workout Files](https://developer.garmin.com/fit/cookbook/encoding-workout-files/)
Last verified: 2026-01-27

Required message sequence

- File ID (type = Workout) first
- Workout message second
- One or more Workout Step messages after

Minimal creation flow

- Create output stream (read/write)
- Create encoder
- Open encoder (writes header)
- Write File ID
- Write Workout
- Write Workout Steps in order
- Close encoder (finalize size/CRC)
- Close stream

Workout message essentials

- wkt_name, sport, sub_sport
- num_valid_steps must match number of Workout Step messages

Workout step essentials

- message_index must be zero-based and sequential
- duration_type and duration_value must match
- target_type and target_value/custom_target_value must match
- intensity provides semantics (warmup, active, recovery, cooldown, etc.)

Repeat steps

- Repeat blocks are modeled as a Workout Step using repeat duration type
- The repeat step immediately follows the steps it repeats
- Repeat step references the message_index of the first step in the block

Supported sport/sub-sport combinations

- Running: sport Running, sub_sport omitted
- Cycling: sport Cycling, sub_sport omitted
- Pool Swim: sport Swimming, sub_sport Lap Swimming
- Cardio/Strength/Yoga/Pilates are supported via sport Training or Fitness Equipment with appropriate sub_sport

Custom targets

- Custom HR/power values use custom_target_value_low/high with target_value = 0
- Absolute HR/power must be offset (HR + 100 bpm, Power + 1000 watts)
- Custom speed targets use meters/second scaled by 1000

Swim workout specifics

- sport Swimming with sub_sport Lap Swimming
- Workout message requires pool_length and pool_length_unit
- Active steps should use duration type Distance (meters)
- Rest steps can be Open, Time, or Repetition Time
