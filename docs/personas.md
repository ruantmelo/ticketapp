# Personas

The platform ecosystem involves three primary user profiles. Each has distinct goals, pain points, and success criteria.

---

## 1. Organizer / Producer of Events

**Role:** Creates and manages events. Defines ticket supply, pricing, resale rules, and royalties.

### Profile
- Event production companies, independent organizers, venues.
- Technically varying — may or may not understand blockchain.
- Cares about revenue control, fraud prevention, and audience data.

### Goals
- Create events with custom ticket tiers, quantities, and prices.
- Enforce a maximum resale price to combat scalping (cambismo).
- Earn a programmable royalty on every secondary-market transaction.
- Track real-time sales and secondary market activity.

### Pain Points (current state)
- No way to stop scalpers from reselling at inflated prices.
- No revenue from the secondary market.
- Cannot verify how many tickets are authentic vs. counterfeit at the door.
- Limited visibility into who actually attends vs. who bought.

### Success Criteria
- Can deploy a ticketed event in under 15 minutes via a web panel.
- Resale price cap is enforced cryptographically — no off-platform workaround.
- Royalties accumulate automatically with zero manual reconciliation.
- Dashboard shows primary sales, secondary volume, and attendee demographics in real time.

### Features
| Feature | ID |
|---------|----|
| Event Creation Panel | F-ORG-01 |
| Minting Engine | F-ORG-02 |
| Secondary Market Configuration | F-ORG-03 |
| Analytics Dashboard | F-ORG-04 |

---

## 2. Buyer / Fan

**Role:** The end user who purchases tickets and attends events.

### Profile
- General public, fans of artists/teams/events.
- Mostly non-technical. Does not know or care about blockchain.
- Expects a purchase experience comparable to conventional ticketing (few clicks, familiar payment).

### Goals
- Buy tickets quickly with email login and FIAT payment (Pix, card).
- Buy from the primary sale or safely from other users on the secondary market.
- Guaranteed that the ticket is authentic — no risk of buying a fake.
- A frictionless entry experience at the venue.

### Pain Points (current state)
- Fear of buying counterfeit tickets from third parties.
- Scalpers drive prices far above face value.
- Complicated or non-existent resale options if they can no longer attend.
- Blockchain apps require seed phrases and crypto wallets — too complex.

### Success Criteria
- Can register and buy a ticket in under 3 minutes using only email + Pix/card.
- Never sees a seed phrase, wallet address, or gas fee concept.
- Can list a ticket for resale at a fair price within the platform's rules.
- Ticket in the app displays a dynamic QR that cannot be screenshotted and reused.
- Entry is as fast as showing the phone screen to a scanner.

### Features
| Feature | ID |
|---------|----|
| Web2.5 Onboarding (Custodial Wallet) | F-BUY-01 |
| Integrated Marketplace | F-BUY-02 |
| FIAT Payments (Pix + Card) | F-BUY-03 |
| Dynamic Ticket QR (Anti-Print) | F-BUY-04 |

---

## 3. Validator / Door Staff

**Role:** The physical team at the event entrance responsible for scanning tickets and admitting attendees.

### Profile
- Event staff, security personnel, volunteers.
- Not technical. No blockchain knowledge required or expected.
- Works under time pressure at busy entrances, sometimes with unreliable internet.

### Goals
- Scan attendee tickets as fast as possible to keep the line moving.
- Instantly know if a ticket is valid, already used, or fraudulent.
- Keep validating even if the venue's internet connection drops.

### Pain Points (current state)
- Counterfeit QR codes/barcodes are indistinguishable from real ones.
- Screenshots of valid tickets are reused by multiple people.
- Internet outages at the door halt the entire entry process.
- Slow validation creates long queues and poor attendee experience.

### Success Criteria
- Scanner app opens and is ready to scan in one tap.
- Validation result (valid / already used / invalid) appears in under 1 second.
- No blockchain knowledge needed — the app abstracts all on-chain checks.
- Can continue validating for a configurable period during internet outages.
- Clear visual + haptic feedback for each scan result.

### Features
| Feature | ID |
|---------|----|
| Scanner App | F-VAL-01 |
| Offline Mode / Cache | F-VAL-02 |
