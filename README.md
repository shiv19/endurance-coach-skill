# Endurance Coach

Endurance Coach allows you to use Claude (or any AI assistant) to create custom-tailored training programs for triathlons, marathons, and other endurance activities. Using a data-driven approach and principles from top training plans, the AI will create a training plan that's uniquely fit for you, your personal fitness, and the constraints you have in the next couple of weeks. Maybe you're recovering from an injury, maybe you're traveling and don't have access to a pool or track in a certain week - tell the AI about it and it'll create a plan that works for you.

The output is a beautiful training plan app that allows you to add, edit, or move workouts, mark them as complete, and update key training data like heart rate zones, LTHR, threshold paces, FTP, and others. Your data is kept locally in your browser.

Workouts can be exported as simple calendar events (.ics), Zwift (.zwo), Garmin (.fit), or TrainerRoad/ERG (.mrc) workouts.

## Examples

See example training plans at [shiv19.github.io/endurance-coach-skill](https://shiv19.github.io/endurance-coach-skill/#demos).

## Installation & Creating a training plan

This skill works with any AI assistant that supports Skills (Claude.ai, Claude Code, and others). To use this tool, you need access to an AI assistant with network access for Skills. Depending on user/admin settings, Skills may have full, partial, or no network access.

Syncing all your Strava activities and creating a tailored training plan takes ca. 15 minutes.

### Installing the Skill

First, [download the latest skill from GitHub Releases](https://github.com/shiv19/endurance-coach-skill/releases/latest/download/endurance-coach-skill.zip).

**Claude.ai:**

1. Open [Claude.ai Settings](https://claude.ai/settings/capabilities)
2. Enable "Code execution and file creation"
3. In the allowed domains list, add `*.strava.com`
4. Scroll down to "Skills" and click "Add skill", then upload the `endurance-coach-skill.zip` file

**Claude Code:**

1. Run `/install-skill` and provide the path to the `endurance-coach-skill.zip` file you downloaded.

### Creating a plan

Use the most capable model available to you. Prompt your AI assistant with something like this:

> Help me create a training plan for the Ironman 70.3 Oceanside on March 29th 2026 using the "endurance-coach" skill.

Your AI assistant will ask how you'd like to provide your fitness data. You have two options: You can either tell the AI about your fitness history manually - or you can give it access to your Strava activities. I recommend the later - data doesn't lie and more data allows the AI to make a training plan that really fits you.

#### Option 1: Connect to Strava (Recommended)

The easiest way to get a personalized plan is to let your AI assistant analyze your Strava training history. This gives the AI real data about your current fitness, training patterns, and progress.

The AI needs a `Client ID` and `Client Secret` to access your Strava activities. You're only giving the AI access to your data - nobody else gets to see it.

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and log in with your Strava account
2. You'll see a form titled "My API Application" - fill it out:
   - **Application Name**: Enter anything you like (e.g., "Endurance Coach")
   - **Category**: Select "Data Importer"
   - **Club**: Leave this blank
   - **Website**: Enter any URL (e.g., `https://claude.ai`)
   - **Application Description**: Enter anything (e.g., "Training plan generation")
   - **Authorization Callback Domain**: Enter `localhost`
3. Check the box to agree to Strava's API Agreement and click **Create**
4. Copy your **Client ID** and **Client Secret** and give them to the AI when prompted

#### Option 2: Manual Entry

Don't use Strava, or prefer not to connect it? No problem. You can tell the AI about your fitness directly. Be prepared to share:

**Current Training (recent 4-8 weeks):**

- Weekly training hours by sport (swim/bike/run)
- Typical long session distances (longest ride, longest run, etc.)
- Training consistency (how many weeks have you been training regularly?)

**Performance Benchmarks (any you know):**

- Bike FTP (Functional Threshold Power) in watts
- Run threshold pace or recent race times (5K, 10K, half marathon, etc.)
- Swim CSS (Critical Swim Speed) or recent time trial (e.g., 1000m time)
- Max heart rate and/or lactate threshold heart rate

### Telling the AI about your event & constraints

In the next step, the AI will ask you about yourself, the event you're training for, and any constraints it should keep in mind. Examples of information you'd tell any coach:

- Years in the sport
- Previous races completed (distances and approximate times)
- Any recent breaks from training
- Injuries or health issues
- Schedule limitations (work travel, family, etc.)
- Equipment access (pool availability, trainer, etc.)

The AI will use this information to create a plan tailored to your current fitness level. The more detail you provide, the better your plan will be.

# About

Endurance Coach is an independent, open-source project based on Felix Rieseberg's Claude Coach. It is not made by, endorsed by, or affiliated with Anthropic, PBC. "Claude" is a trademark of Anthropic. This skill works with Claude and other AI assistants but is developed and maintained independently. License: MIT.
