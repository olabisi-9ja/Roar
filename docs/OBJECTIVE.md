# Objective fit

The hackathon asks for AI-powered apps and agents, built on GitHub, Microsoft Foundry, Azure AI Services, Microsoft Fabric and Azure data and cloud-native services, that do six things. This maps each one to Roar.

Screen numbers refer to [design/roar-app-design.html](design/roar-app-design.html).

| Objective | What Roar does | Screens | Microsoft services |
| --- | --- | --- | --- |
| Analyze match events in real time | Fan clips and photos are classified as they upload (goal, save, foul, crowd, safety) and anchored to official live match events. Same-event clips cluster into one Moment within ~30s. | 2.2, 3.4, 7.1, 9.1 | Foundry (Moment Analyst and Moment Matcher agents), Azure AI Video Indexer, Azure AI Vision, Event Hubs, Container Apps workers, Web PubSub |
| Generate stories, highlights and recaps | AI writes Moment titles and summaries, a live match story, and cuts 15/30/60s multi-angle recaps from the best-ranked fan angles. | 2.3, 2.5, 9.3 | Foundry (Storyteller and Highlight Curator agents), Video Indexer, Blob Storage |
| Explain key moments and tactical patterns | Every Moment has a plain-language explanation. The tactics view explains why it worked (runs, presses, overloads) from event data plus fan angles, at beginner or expert depth. | 2.3, 10.1 | Foundry (Tactics Analyst agent), live data feed via the stats-ingest worker |
| Expand datasets for AI and analytics | Every fan upload becomes a labelled, multi-angle, time-synced record (event type, players, section, quality rank, AI confidence, moderator decision). Together they form a crowd-sourced dataset no broadcast feed has. It lands in OneLake for analytics and model evaluation. | 9.4, 9.5, 10.3 | Microsoft Fabric (Eventstream, Eventhouse, OneLake, Power BI), Azure Database for PostgreSQL, Foundry evaluations |
| Insights for fans worldwide in multiple languages | Summaries, match story, captions and recaps in the fan's language, with text and audio versions. | 2.5, 9.3, 10.2 | Azure AI Translator, Azure AI Speech, Foundry |
| Personalized experiences for studios, streaming platforms and fans | Fans get a feed tuned to their team, players, language and explanation depth. Studios and streaming platforms get a partner console: Moments API, recap webhooks and an embeddable live-Moments widget, filtered to their rights and languages. | 9.3, 10.2, 10.3 | API Management, Foundry, Azure AI Search (Moment search), Fabric |

## Supporting services

- **Safety layer:** Foundry Safety Analyst and Security Coordinator agents, Azure AI Content Safety for moderation suggestions (5.x, 9.1, 9.2, 9.4).
- **Platform:** Key Vault for secrets, Application Insights for monitoring, Azure Container Apps for the API and workers.
- **GitHub:** repo and Issues, GitHub Actions for CI/CD to Azure, GitHub Copilot in the editor and the Copilot coding agent for well-scoped Issues. Say this in the pitch and show one Copilot-authored pull request.

## Demo order for judges

1. Fan captures a goal, AI analyses it and finds 17 other angles (real time).
2. Moment opens with an AI summary, then the tactics view explains the move (explain).
3. Switch language to French and play the audio recap (multilingual).
4. Call It question appears from live stats (personalised, real time).
5. SOS flows into the security dashboard (safety).
6. Partner console shows the same Moment arriving through the API, and Fabric shows the dataset growing (studios, datasets).
