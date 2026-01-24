## Roadmap

### Bugs

- Fix incorrect training start dates. The Athlete part of the yaml has a eventDate but no trainingStartDate, check what is determining the training start date and fix it.

### Epic: Workout Template Enhancements

- The CLI expander should throw an error if an unknown workout template name is used, and suggest that the agent can create a custom workout template or use a known template.
- Custom workout templates go in ~/.endurance-coach/workout-templates/ the render function should look there for templates first before looking in the built-in templates.
- The CLI expander should have a --list-templates option to list all known workout templates, both built-in and custom.
- The CLI expander should have a --show-template TEMPLATE_NAME option to display the contents of a specific workout template, whether built-in or custom.
- There are still certain template variables that are not being used in the Viewer project.

### Epic: Post-Workout Interview with Agent

- Skill enhancement: User can ask the agent to conduct a post-workout interview, agent starts by syncing workout (if strava enabled), else asks naturally for workout details.
- Agent asks a series of questions about the workout, including:
  - How did the workout feel overall?
  - Were there any specific challenges or highlights during the workout?
  - Did you stick to the planned workout structure?
  - How was your energy and hydration levels?
  - Any areas for improvement or adjustments for future workouts?
- If something is inferrable from the workout data (e.g., pace, heart rate), the agent should incorporate that into the questions or feedback.
- After the interview, the agent summarizes the key points, and saves them to the coach.db ~/.endurance-coach/coach.db associated with that workout.
- ^ this actually requires a db schema update to the coach.db, we should handle it with db increments for backwards compatibility.
- Store interview data in a separate table with a foreign key to the workout id, enabling support for multiple interviews per workout.
- Optionally, the web UI can remind the user to do a post-workout interview when they mark a workout as completed.
- **Stretch Goal**: Enable in-app interview chat within the web UI by having the CLI launch a local web server for the interview session, allowing the user to conduct the interview using the same agent framework they're configured with. This could potentially spin off into a separate epic to avoid scope creep.

### Epic: Web UI Enhancements

- When user opens a workout card, show floating arrow buttons to the left and right of the card to navigate to previous/next workout without going back to the calendar view.
- Expanded Side bar to view the side bar content without needing to scroll.
