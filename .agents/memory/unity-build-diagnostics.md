---
name: Unity build diagnostics
description: Finding the active Windows Unity build log when the default Editor log only contains startup information
---

Do not assume the Windows AppData Editor log contains the active build output. Unity 6.6 can redirect subsequent logging to a project-relative Logs/Editor.log; follow the destination stated in the startup log.

**Why:** The user's Unity installation explicitly redirected logging, leaving the default AppData file with only startup information and no Gradle failure details.

**How to apply:** For local Quest build troubleshooting, use the active log identified by that redirection. Request only the latest Gradle “What went wrong” section rather than full startup logs, which can contain temporary session credentials.

Check both launcher and unityLibrary compile SDK values when investigating AAR metadata failures; changing Player settings does not prove both modules now use the same API.

**Why:** In the user's Meta Quest build, a settings change advanced the metadata failure from unityLibrary to launcher, which still compiled against API 32.

**How to apply:** Read the module named in the newest failure. Do not keep asking for the same Target API change when the remaining mismatch is in another module or an unnecessarily high library compile requirement.
