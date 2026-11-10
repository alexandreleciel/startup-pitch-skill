# Meridian product vision

_Last edited: 2026-09-14, Lena + Jonas_

## The one sentence

Every truck arriving at a mid-size logistics site should know where to go, when, and what it needs, without
anyone making a phone call.

## Why this matters

A mid-size forwarder with 6 sites does about 1,500 truck movements a week. Today each one costs the dispatcher
2 to 4 phone calls and a WhatsApp thread. The yard is a traffic jam between 06:00 and 09:00 and empty after
14:00. Drivers wait an average of 70 to 110 minutes (our interview data, docs/customer-interviews-notes.md).
Carriers charge waiting fees. The site manager has no idea which carrier is late most often because the data
lives in six phones.

Large shippers solved this ten years ago with yard management systems that cost EUR 200k+ and need a
six-month implementation. Nobody built the version for the mid-market.

## What we believe

1. **The carrier side must be zero-friction.** No app download, no account. A link. If a driver cannot use it
   from a cab in 20 seconds, it is dead.
2. **Comms is the wedge, scheduling is the lock-in.** Customers come for "stop the phone calls", stay because
   the schedule becomes the system of record for the yard.
3. **Mid-market needs 2-week onboarding, not 6-month.** Everything we build must be self-configurable by a site
   manager.
4. **The data becomes the product.** Carrier performance data across sites (and eventually across customers,
   anonymised) is something no mid-size operator has today.

## Roadmap (next 18 months)

| Quarter | Theme | Notes |
|---|---|---|
| Q4 2026 | Multi-site rollouts | 4 customers want all sites on; needs org hierarchy and SSO |
| Q1 2027 | Carrier scorecards | Wait time, no-show, on-time by carrier. First "data product" |
| Q2 2027 | TMS integrations | Connectors to the 3 TMS products our customers actually use |
| Q3 2027 | Carrier network | Carriers see all Meridian sites they deliver to in one view |
| Q4 2027 | Pricing v2 | Per-movement pricing for high-volume sites |

## Non-goals

- We are not a TMS. We do not plan routes or price freight.
- We are not building for ports or rail terminals (different workflow, different buyer).
- No hardware. No cameras, no license-plate readers. Partners can do that.

## Open questions

- Do we go deeper in DACH or open France/Poland in 2027? (Lena says Poland, Jonas says depth.)
- Per-site vs per-movement pricing. Current per-site pricing undercharges the 2 biggest customers.
