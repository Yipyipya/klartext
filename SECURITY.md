# Security policy

## Supported versions

Nivune 1.0 is currently under development and has not been publicly released.
Security fixes are prepared on the active development branch. The existing 0.3.0
preview must not be treated as a supported security release.

After 1.0, this section will list the supported release line explicitly. Nivune
does not currently promise a fixed response time or service-level agreement.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability that could expose API
keys, transcripts, recordings, local files, or another user's system.

Use GitHub's private vulnerability reporting flow in the repository's **Security**
tab. Include the affected version or commit, platform, reproduction steps, impact,
and whether the report contains sensitive data. Do not attach real secrets or
private recordings; use a minimal synthetic example.

If private reporting is unavailable, open a public issue containing no exploit
details or sensitive data and ask the maintainer to establish a private channel.

## Scope priorities

Reports are especially important when they concern secret storage, unexpected
network transmission, microphone activation, Electron renderer isolation, file
imports, local history, update or installer integrity, or unsafe provider
redirects.
