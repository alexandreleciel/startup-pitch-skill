# BOM estimate (v2, Oct 2026)

At 1,000 units. Quotes are from 2 Shenzhen contract manufacturers (via a friend's intro) plus Digikey for
the electronics. Rough.

| Part | Cost / unit |
|---|---|
| Enclosure (injection molded ABS, 2 parts) + glass door | $21.00 |
| Peltier module + heatsinks + fans (heat AND cool, this is the hard part) | $18.50 |
| Humidity control (ultrasonic mister + small reservoir) | $6.20 |
| Main board (ESP32-based, custom PCB, assembled) | $11.40 |
| Sensors (temp x2, humidity, CO2) | $7.80 |
| Power supply 12V 5A | $5.10 |
| Interior: 2 glass jars (1.5L) + stainless rack | $9.60 |
| Touch display 2.8" | $4.70 |
| Packaging + manual | $3.90 |
| Assembly + test (quoted) | $7.80 |
| **Total** | **$96.00** |

Tooling (injection molds): ~$85k one-time. That is the big pre-seed line item.

## Pricing thoughts

- Target retail **$299**. Landed cost with shipping + duties probably ~$118. Gross margin on hardware ~60% if
  sold direct. If we go retail (Williams Sonoma type), their margin eats most of that so the subscription has
  to carry it.
- Subscription **$12/mo** for recipes + guided programs + community. Gross margin basically 90%+.
- Hoping for 40%+ of buyers to subscribe. No data on that obviously. Deposits were for the box only.

## Open BOM risks

- Peltier approach is noisy and power hungry. A compressor would be quieter but doubles cost and size.
- CO2 sensor might be unnecessary for v1. Saves $4.
- Haven't done UL / FCC yet. Budget ~$25k.
- At 5,000 units BOM probably drops to ~$78.
