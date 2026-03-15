# Security Policy

## Project Status

**Current Version**: 1.0.0 (Beta)

This project is currently in **beta**. We run a single production version with continuous deployment - all security fixes are applied directly to the live version.

There are no legacy versions to maintain or backport patches to.

## Reporting a Vulnerability

**DO NOT** open public GitHub issues for security vulnerabilities.

### Preferred Reporting Method

Use [GitHub Security Advisories](https://github.com/gennaropaglia/tenpennynovels/security/advisories/new) to privately report security issues.

Alternatively, email: **gennaro.paglia@gmail.com** with subject line: `[SECURITY] TenpennyNovels - [Brief Description]`

### What to Include

- **Description**: Clear explanation of the vulnerability
- **Steps to reproduce**: Detailed reproduction steps
- **Impact**: Potential damage (data leak, privilege escalation, etc.)
- **Affected components**: Which service/module (api-gateway, unified-backend, botai-backend, etc.)
- **Suggested fix**: Optional, but appreciated

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix deployment**: Depends on severity
  - **Critical** (RCE, auth bypass, data leak): 24-48 hours
  - **High** (privilege escalation, XSS): 7 days
  - **Medium/Low**: Next release cycle

## Scope

### In Scope

- Authentication & authorization bypass
- SQL/NoSQL injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Server-Side Request Forgery (SSRF)
- Sensitive data exposure
- API vulnerabilities (REST & WebSocket)
- Docker/deployment misconfigurations exposing sensitive data

### Out of Scope

- Denial of Service (DoS/DDoS) attacks
- Social engineering attacks
- Physical security
- Vulnerabilities in third-party dependencies (report to upstream, but notify us if actively exploited)
- Issues requiring physical access to infrastructure

## Security Measures

- Dependencies scanned with **Dependabot**
- Environment variables for secrets (no hardcoded credentials)
- MongoDB connection strings use authentication
- Docker services isolated with internal networks
- PM2 process management with automatic restarts

## Responsible Disclosure

We follow **coordinated disclosure**:

1. **Report received** → Private acknowledgment
2. **Verification** → We confirm the issue
3. **Fix development** → Patch created & tested
4. **Deployment** → Fix deployed to production
5. **Public disclosure** → After fix is live (coordinated with reporter)
6. **Credit** → Reporter credited in release notes (if desired, name/handle of your choice)

## Contact

- **Email**: gennaro.paglia@gmail.com
- **GitHub Security Advisories**: Preferred method
- **Response hours**: Usually within 48h (longer on weekends/holidays)

---

Thank you for helping keep TenpennyNovels secure!
