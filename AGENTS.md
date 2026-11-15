<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `bunx --no-install --package @tanstack/intent intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx --no-install --package @tanstack/intent intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Explorer HUD

The Mexicali explorer keeps crop models on whenever land cover is loaded, and keeps the green crop-soil overlay on the terrain. Subsidence 3D exaggeration stays at ×2000. Do not add floating tool menus (layers, models, context, events, credits, crops, destinations, inspector, settings). When the ship is parked, the nearest map model is shown only in the dedicated 3D view, not in a catalog panel.
