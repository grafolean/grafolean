---
name: Bug report
about: Create a report to help us replicate the issue
title: ''
labels: ''
assignees: grafolean

---

**Steps To Reproduce**
Steps to reproduce the behavior:
1. Run '...'
2. Open browser, Go to...
3. Click on '....'
4. See error

**Whan went wrong**
A clear and concise description of the error message. Include output of `docker logs grafolean`, screenshots and/or browser console if applicable.

**Expected behavior**
What you expected to happen instead.

**Software versions:**
 - Docker version [`docker --version`]
 - docker-compose version [`docker-compose --version`]
 - Browser [e.g. firefox, chrome, safari] - if applicable
 - Grafolean Version [`docker inspect --format '{{ index .Config.Labels "org.label-schema.version"}}' grafolean`]

**Additional context**
Add any other context about the problem here.
