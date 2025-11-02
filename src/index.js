import fs from "fs";
import axios from "axios";
import dayjs from "dayjs";

const stateFile = "data/wuwu.json";
const readmeFile = "README.md";
const MAIN_REPO = process.env.MAIN_REPO || "nishuR31/nishuR31";
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.error("Missing GH_TOKEN in environment variables.");
  process.exit(1);
}

const headers = { Authorization: `token ${GH_TOKEN}` };
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));

/* === FETCH GITHUB ACTIVITY === */
async function getGitHubStats() {
  const user = state.owner;
  const [eventsRes, userRes, repoRes] = await Promise.all([
    axios.get(`https://api.github.com/users/${user}/events/public`, { headers }),
    axios.get(`https://api.github.com/users/${user}`, { headers }),
    axios.get(`https://api.github.com/repos/${MAIN_REPO}`, { headers })
  ]);

  const today = dayjs().format("YYYY-MM-DD");
  const todayCommits = eventsRes.data.filter(
    e => e.type === "PushEvent" && dayjs(e.created_at).format("YYYY-MM-DD") === today
  ).length;

  return {
    commitsToday: todayCommits,
    followers: userRes.data.followers,
    stars: repoRes.data.stargazers_count,
    totalRepos: userRes.data.public_repos
  };
}

/* === UPDATE WUWU'S STATE === */
function updateLogic(stats) {
  // Base decay
  state.status.food = Math.max(0, state.status.food - 5);

  // Gains with activity
  if (stats.commitsToday > 2) state.status.food = Math.min(100, state.status.food + 20);
  if (stats.commitsToday > 0) state.status.intelligence = Math.min(100, state.status.intelligence + 1);

  // Health influenced by food and intelligence
  state.status.health = Math.min(100, Math.floor((state.status.food + state.status.intelligence) / 2));

  // Knowledge increases with milestones
  if (stats.followers % 5 === 0 || stats.stars % 10 === 0)
    state.status.knowledge = Math.min(100, state.status.knowledge + 1);

  // Age increment monthly
  const last = dayjs(state.last_updated);
  if (dayjs().diff(last, "day") >= 30) {
    state.aging.current_age_months += state.aging.growth_rate_per_month;
    state.status.age_months = state.aging.current_age_months;
  }

  // Mood logic
  if (state.status.food < 25) state.status.mood = "grumpy";
  else if (state.status.food < 50) state.status.mood = "tired";
  else if (state.status.health < 40) state.status.mood = "lazy";
  else if (state.status.intelligence > 70) state.status.mood = "curious";
  else if (state.status.knowledge > 60) state.status.mood = "motivated";
  else state.status.mood = ["chill", "energetic", "happy"][Math.floor(Math.random() * 3)];

  // Update time
  state.last_updated = dayjs().toISOString();

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(` Wuwu updated: ${state.status.mood} | Food ${state.status.food}% | Health ${state.status.health}%`);
}

/* === UPDATE README === */
function updateReadme() {
  const svgFile = `assets/${state.status.mood}.svg`;
  const petImg = fs.existsSync(svgFile) ? svgFile : "assets/wuwu.svg";

  const content = `
# Meet Wuwu

<p align="center">
  <img src="./${petImg}" width="180" alt="Wuwu's current mood: ${state.status.mood}" />
</p>

---

### Current Stats

| Attribute | Value |
|------------|--------|
| **Age** | ${state.status.age_months} months |
| **Mood** | ${state.status.mood} |
| **Health** | ${state.status.health}% |
| **Food** | ${state.status.food}% |
| **Intelligence** | ${state.status.intelligence}% |
| **Knowledge** | ${state.status.knowledge}% |
| **Last Updated** | ${dayjs(state.last_updated).format("YYYY-MM-DD HH:mm")} |

---

### Activity Insights
| Metric | Value |
|---------|-------|
| **Commits Today** | ${state.activity?.commitsToday || "—"} |
| **Followers** | ${state.activity?.followers || "—"} |
| **Stars on Main Repo** | ${state.activity?.stars || "—"} |
| **Public Repos** | ${state.activity?.totalRepos || "—"} |

---

###  About Wuwu
> Wuwu evolves from my GitHub life — commits feed its mind, stars fuel its energy, and followers shape its personality.  
> The more I build, the smarter and stronger Wuwu grows.

---

<p align="center">
  <sub>Updated automatically by [GitHub Actions](.github/workflows/wuwu.yml)</sub>
</p>
`;

  // Store latest activity snapshot for future stats section
  state.activity = {
    commitsToday: state.activity?.commitsToday ?? 0,
    followers: state.activity?.followers ?? 0,
    stars: state.activity?.stars ?? 0,
    totalRepos: state.activity?.totalRepos ?? 0,
  };

  fs.writeFileSync(readmeFile, content.trim());
  console.log("README updated successfully with richer layout.");
}


/* === RUN === */
(async () => {
  try {
    const stats = await getGitHubStats();
    updateLogic(stats);
    updateReadme();
  } catch (err) {
    console.error("Update failed:", err.response?.data || err.message);
    process.exit(1);
  }
})();
