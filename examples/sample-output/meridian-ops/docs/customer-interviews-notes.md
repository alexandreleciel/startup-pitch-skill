# Customer interview notes

Running file. Newest at the bottom. Names are first-name only, company names are fine internally.

---

## 1. Nordfracht GmbH, Hamburg, Head of Operations (Birte), 2025-03-11

Site: 3 warehouses, ~400 movements/day across all sites.

- Before us: "Three dispatchers, each with two phones. One of them has a notebook. A paper notebook."
- Pain: morning peak. 60% of trucks arrive between 06:00 and 09:30, docks idle in the afternoon.
- Carriers charge waiting fees after 90 minutes. Last year ~EUR 38k in waiting fees at the Hamburg site alone.
- Quote: **"I do not need a yard management system. I need the drivers to stop calling me."**
- Tried: Excel booking sheet shared via email. Died after 3 weeks because carriers did not update it.
- Would pay: "If it saves me one dispatcher, anything under 3k a month is a no-brainer."

## 2. Weserkraft Spedition, Bremen, Site Manager (Markus), 2025-04-02

Site: 1 big cross-dock, 220 movements/day.

- Uses a WhatsApp group with 40 drivers. "It works until someone posts a photo of their lunch."
- Does not trust carriers to book slots. "They will book 7:00 and arrive at 10:00 anyway."
  -> Led to the no-show tracking + carrier reliability score feature.
- Quote: "Show me which carrier is always late and I will use it in the next rate negotiation. That is worth
  money to me."
- Would NOT pay for reporting alone. Needs the operational tool first.

## 3. Rhein-Main Cargo Services, Frankfurt, COO (Sabine), 2025-06-18

Site: 5 sites, 600+ movements/day. Our largest prospect at the time.

- Had evaluated a big yard management system (quote: EUR 180k implementation + EUR 4k/month per site).
  Rejected: "we would need a project manager just to run the project."
- Key requirement: multi-site view, SSO, and she wants it live in 4 weeks.
- Quote: **"Everything in this industry is built for DHL. We are not DHL."**
- Concern: driver adoption. Many drivers are subcontractors from Poland and Romania, mixed language.
  -> Led to multi-language SMS (DE/EN/PL/RO).
- Became a customer in Sept 2025. 2 sites live, 3 pending (SSO).

## 4. Baltic Line Freight, Rostock, Owner (Henrik), 2025-09-30

Site: 1 site, 90 movements/day. Small for us.

- Honest: "I am probably too small for you." He was right. Churned after 4 months (Dec 2025).
- Learned: below ~120 movements/day the pain is tolerable with a whiteboard.
- Quote: "It is nice, but I can see my whole yard from my office window."
- Still useful: he told us which 3 competitors he had looked at (see notes/competitors.md).

## 5. Vantrex Logistics BV, Rotterdam area, Operations Director (Pieter), 2026-02-12

Site: 4 sites, 350 movements/day, lots of container drayage.

- Different flow: trucks arrive from the port with a time window from the terminal. Needs to ingest terminal
  slot times. We do not do this yet.
- Quote: "If you can read the terminal appointment and plan my dock around it, I will sign today."
- Signed anyway for 2 sites in March 2026 as "phase 1". Phase 2 depends on the integration.
- Pays EUR 2,400/month. Our second-largest.

## 6. Südlager Logistik, Munich, Head of Dispatch (Ayse), 2026-08-05

Site: 2 sites, 180 movements/day. Automotive tier-2 supplier logistics, so lots of JIT pressure.

- Current: an old on-prem scheduling tool from a company that no longer exists. "Nobody knows the admin password."
- Quote: **"Every minute a truck waits here is a minute the line in Dingolfing might stop."**
- Wanted: hard integration with the customer's call-off system. Out of scope for now, but she took it anyway.
- Interesting: she asked whether her carriers could see their own performance. Nobody had asked for that before.
- Signed Sept 2026. 2 sites.

---

## Patterns (updated Aug 2026)

- Sweet spot: 150 to 600 movements/day, 2+ sites. Below that, churn risk.
- "Stop the phone calls" is the universal opener. Reporting is the universal retention argument.
- Multi-language driver comms is a real differentiator in DACH, nobody expected it.
- Three of six asked about integrations we do not have (terminal slots, TMS, call-off). Roadmap.
