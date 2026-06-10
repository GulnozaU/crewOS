# CrewOS Sample Data — Sunrise Coffee Co.

Demo company and SOP documents for hackathon testing and demo video.

## Sample company

| Field | Value |
|-------|-------|
| Name | Sunrise Coffee Co. |
| Industry | Food & Beverage |

## Sample employees

| Name | Role | Email |
|------|------|-------|
| Alex Rivera | Barista | alex@sunrisecoffee.demo |
| Jordan Lee | Shift Lead | jordan@sunrisecoffee.demo |
| Sam Patel | Manager | sam@sunrisecoffee.demo |

## SOP documents (`samples/sops/`)

1. **01-opening-procedures.txt** — Store opening, equipment, cash drawer
2. **02-customer-service.txt** — Greeting, orders, complaints, upselling
3. **03-espresso-bar.txt** — Drink recipes, extraction, milk steaming
4. **04-food-safety.txt** — Hygiene, allergens, temperature control
5. **05-cash-handling.txt** — POS, voids, refunds, deposits
6. **06-closing-procedures.txt** — End-of-day cleanup and security

## Quick seed (automated)

```bash
# Terminal 1
npm run dev

# Terminal 2
chmod +x scripts/seed-demo.sh
./scripts/seed-demo.sh
```

## Manual upload

1. Open http://localhost:3000/owner
2. Create company **Sunrise Coffee Co.**
3. Add employees from the table above
4. Upload each file from `samples/sops/`

## Demo flow for judges

1. Owner uploads SOPs → Gemini generates training
2. Employee **Alex Rivera** completes training → quiz → roleplay
3. Manager approves certification
4. Schedule generated from approved certifications
