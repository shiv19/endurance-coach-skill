# FIT Workout File Type Summary

Source: https://developer.garmin.com/fit/file-types/workout/

Required messages

- File ID: must be first; type set to Workout (5)
- Workout: summary message for the file
- Workout Step: one or more steps describing the workout

Message sequence

1. File ID
2. Workout
3. Workout Step (1..n)

Workout message fields (notable)

- sport, sub_sport
- wkt_name
- num_valid_steps
- pool_length and pool_length_unit for pool swims

Workout step fields (notable)

- message_index: zero-based, unique per step; used by repeat steps
- duration_type + duration_value: dynamic fields; must match duration_type
- target_type + target_value/custom_target_value: dynamic fields; must match target_type
- intensity: Active, Rest, Warmup, Cooldown, Recovery, Interval, Other
- notes and equipment are optional

Duration type mapping (examples)

- time -> duration_time
- distance -> duration_distance
- open -> duration_value
- repeat_until_steps_cmplt -> duration_step plus repeat_steps
- repetition_time -> duration_time (used for swim rest steps)

Target type mapping (examples)

- speed -> target_speed_zone or custom_target_speed_low/high
- heart_rate -> target_hr_zone or custom_target_heart_rate_low/high
- power -> target_power_zone or custom_target_power_low/high
- cadence -> target_cadence_zone or custom_target_cadence_low/high
- stroke_type -> target_swim_stroke

Repeat blocks

- Represented by a Workout Step with duration_type repeat_until_steps_cmplt
- duration_value points to the start message_index of the block
- target_value is the number of repetitions
