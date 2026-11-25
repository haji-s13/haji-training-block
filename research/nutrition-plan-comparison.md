# Nutrition plan comparison: app targets vs published guidance (maintain, lose, gain)

- Date: 2026-11-25
- Question: For an 84.3 kg male on the app's Norwegian-method week (about 104 km plus 4 lifts), do
  the targets in `lib/nutrition.ts` for maintenance, weight loss and weight gain match published
  guidance? Do the total calories make sense, and what should change?
- Builds on: `research/nutrition-endurance-runner.md` (2026-11-23), which the app's rules came from.

> Not medical or dietetic advice. Population ranges only.

## Answer

- **Maintenance: right on average, wrong in shape.** Over the week, the app's intake (about 4,170
  kcal/day, 49.5 kcal/kg) is within about 60 kcal/day of its own burn estimate. That is
  plausible next to the few doubly-labelled-water studies of distance runners (see Details).
  Day by day it is skewed. Easy days, which here also carry a 40 to 70 min lift, are about
  480 kcal **under** burn. Hard and double days are 230 to 740 kcal **over**. The cause is
  that fat is a fixed 25% share, so fat grams rise with carbs (77 g on a rest day, 140 g on a
  double day). Carb gears and 2.2 g/kg protein are within guidance. Fat at 25% is within
  ACSM's 20 to 35%, but fixing fat as a share of energy puts the most fat on the days when
  the refuelling advice says to keep fat low.
- **Weight loss: the cut is in the right place but far too small, and it lands on the wrong
  days for energy availability.** With no rest day in this template, "lose 500" only cuts 3
  days, so the deficit is 1,500 kcal/week against maintenance and about 1,110 kcal/week
  against the burn estimate. That is about 0.14 kg/week, or 0.17% of body weight. Guidance for
  athletes is about 0.5 to 1%/week, and about 0.7%/week if you want to keep lean mass. Even
  the maximum 1,000 kcal setting gives only about 0.4%/week. Meanwhile the easy and lift days
  drop to an estimated 23 kcal/kg FFM of energy availability, below the old 30 reference
  point. Protein at 2.2 g/kg (about 2.6 g/kg FFM) is already in the range recommended for a
  deficit.
- **Weight gain: +300 kcal/day is conservative but defensible.** That is about 7% of intake.
  Published bodybuilding guidance uses a 10 to 20% surplus aimed at 0.25 to 0.5% BW/week.
  Elite-athlete trials used about +500 kcal, and +600 added mostly fat. Adding it all as carbs
  is reasonable for an endurance athlete. On double days, though, it pushes carbs to about 9.9
  g/kg (833 g), which is a lot of food. Putting it on easy and lift days instead would also
  close their shortfall.
- **Structural issue:** calories come from macro rules, not expenditure, and "lose" and
  "gain" are fixed kcal offsets rather than a target rate. The weekly match here is partly
  luck of this template. The burn model's assumptions roughly cancel out (Mifflin likely
  under-reads athletes, while gross MET lifting and the activity factor over the training
  hours over-read slightly), but it is uncertain by several hundred kcal/day.

## Details

### Worked numbers (from the app's own formulas; analysis)

Inputs: 84.3 kg, 177.8 cm, 32 y, male, Mifflin, "moderate" (×1.45). Resting estimate = 1,799
kcal; × 1.45 = 2,609 kcal before training. Training = 1 kcal/kg/km + MET 5 × kg × hours of
lifting (`lib/nutrition.ts:139`). FFM is not known. **Assumption: 15% body fat, so FFM ≈ 71.7
kg.** Energy availability (EA) = (intake − training kcal) / FFM. The app's training kcal are
partly gross, so true EA is a little higher than shown.

| Day (template) | Gear | Run / lift | App intake maintain (C/P/F g) | App burn | Intake − burn | EA maintain | Intake lose (500) | EA lose | Intake gain |
|---|---|---|---|---|---|---|---|---|---|
| Mon easy + Push | easy | 10 km / 70 min | 3,460 (464/186/96) | 3,940 | **−480** | **29.6** | 2,960 | **22.7** | 3,760 |
| Tue double + Legs | double | 20 km / 40 min | 5,040 (758/186/140) | 4,580 | +460 | 42.9 | 5,040 | 42.9 | 5,340 |
| Wed easy + Pull | easy | 10 km / 70 min* | 3,460 | 3,940 | −480 | 29.6 | 2,960 | 22.7 | 3,760 |
| Thu double | double | 20 km / none | 5,040 | 4,300 | +740 | 46.8 | 5,040 | 46.8 | 5,340 |
| Fri easy + Upper | easy | 10 km / 70 min* | 3,460 | 3,940 | −480 | 29.6 | 2,960 | 22.7 | 3,760 |
| Sat X session | hard | 16 km | 4,360 (632/186/121) | 3,960 | +400 | 42.0 | 4,360 | 42.0 | 4,660 |
| Sun long run | hard | 18 km | 4,360 | 4,130 | +230 | 39.7 | 4,360 | 39.7 | 4,660 |
| **Week** | | ~104 km | **29,180** (avg 4,169 = 49.5 kcal/kg) | **28,790** (avg 4,113) | **+390/wk** | avg 37.2 | **27,680** | avg 34.2 | 31,280 |

\*Wed and Fri lifts assumed equal to Monday's. Rest day (none in this template): 2,790 maintain
/ 2,290 lose / 3,090 gain, burn 2,610.

- **Implied loss on "lose 500":** 27,680 − 28,790 = −1,110 kcal/week. At the common ~7,700
  kcal/kg rule of thumb (unsourced here; it overstates loss over longer periods) that is
  ≈0.14 kg/week ≈ **0.17% BW/week**. At the 1,000 max: −2,610/week ≈ 0.34 kg ≈ 0.40% BW/week.
- **What the guidance would need:** 0.5%/week ≈ 0.42 kg ≈ 3,250 kcal/week (≈465/day). 0.7%/week
  ≈ 0.59 kg ≈ 4,540 kcal/week (≈650/day).
- **Weekly average carbs:** 4,172 g / 7 = 596 g/day = **7.1 g/kg**.
- **Implied gain on "gain":** +2,100 kcal/week from the setting, plus the +390 baseline, gives
  ≈ +2,490/week. As an upper bound (if all of it were stored as ~7,700 kcal/kg tissue) that is
  ≈0.32 kg ≈ 0.38% BW/week.

### 1. Maintenance

- **Energy level.** Doubly-labelled-water (DLW) studies of elite runners are small. Nine elite
  Kenyan men (about 56 kg) in heavy training spent about 14,611 kJ/day (≈3,490 kcal), more
  than they ate [17]. My conversion puts that at ≈62 kcal/kg. Elite female distance runners
  spent about 2,826 kcal/day [18] (≈53 kcal/kg by my conversion, about 53 kg). The app's 49.5
  kcal/kg for a heavier, non-elite athlete on about 104 km plus lifting is plausible, since
  per-kg needs fall as body mass rises (analysis). No position stand gives a single kcal/kg
  figure for endurance athletes. ACSM/AND/DC gives macro ranges by training load [1].
- **Carb gears vs ranges.** ACSM/AND/DC: 3–5 g/kg light, 5–7 moderate (~1 h/day), 6–10 high
  (1–3 h/day), 8–12 very high (>4–5 h/day) [1]. The app's rest 4, easy 5.5, hard 7.5 and
  double 9 all fall inside the matching band. Matt Fitzgerald's table (TrainingPeaks,
  secondary; the page could not be opened, values from the search index) gives 8–9 g/kg for
  11–14 h/week [20]. That counts every training hour, lifting included, so the app's 7.1 g/kg
  average is on the low side of his scale and middle of ACSM's high band. The "fuel for the
  work required" framework supports varying carbs by session [4][21][22].
- **Easy plus lift days are the weak spot.** At 5.5 g/kg they are treated as about 1 h of
  light work, but the day holds about 1 h of running plus 70 min of lifting, which is closer
  to ACSM's "1–3 h/day" band [1]. They are also about 480 kcal under the app's own burn
  estimate. That they need more carbs is analysis; this note did not check how much glycogen
  lifting uses.
- **Protein 2.2 g/kg.** This is above ACSM's 1.2–2.0 [1] and ISSN's 1.4–2.0 g/kg for most
  exercisers [2], though ISSN says higher intakes may help in a deficit or for body
  composition [2][8]. On a heavy endurance training day, the IAAO method gave an estimated
  requirement of 1.65 g/kg and a recommended intake of 1.83 g/kg [14]. That supports the app's
  1.8 floor on hard days (`lib/nutrition.ts:61`). The 2.0 floor on double days is a
  reasonable step up but has no direct source. At the 2.2 default, both floors never apply.
  2.2 g/kg is consistent with guidance; it is generous rather than wrong.
- **Fat 25%.** This is inside ACSM's 20–35%, and ACSM warns against going below 20% [1] (via
  the prior note). The problem is mechanical. Because fat is a fixed share
  (`lib/nutrition.ts:73,101-102`), fat grams scale with carbs, from 77 g on a rest day to
  140 g on a double day. That conflicts with the guidance to keep fat and fibre low before
  sessions and while refuelling between sessions under 8 h apart (prior note, Findings 2–3)
  [1]. It also drives most of the hard- and double-day surplus over burn.

### 2. Weight loss

- **Rate.** Bodybuilding guidance is 0.5–1% BW/week to keep muscle [6]. In elite athletes, a
  slow rate (~0.7%/week) raised lean mass by 2.1% and gave more fat loss than a fast rate
  (~1.4%/week), which left lean mass unchanged. Both groups lost about 5.5% of body weight
  [9]. At 12 months the groups no longer differed [9]. ISSN: slower loss preserves lean mass
  better in leaner people, and larger deficits suit people with more body fat [8]. **The
  app's 0.17%/week (0.40% at the max setting) is below all of these.** It is safe, but too
  slow to be a useful "cut" for most goals.
- **Where to put the deficit.** Periodised guidance says to keep carbohydrate high for key
  sessions and lower it for easy ones [4][21][22]. Stellingwerff et al. treat energy as the
  baseline for physique work and stress keeping EA adequate [21]. Jeukendrup describes weight
  management as a phase-level goal inside the training year [22]. **The app's choice to cut
  rest and easy days and protect hard and double days matches this.** In this template,
  though, the "easy" days carry the lifts, start about 480 kcal under burn, and end about
  980 under after the cut.
- **Energy availability floors.** EA = (intake − exercise energy) / FFM [3]. Loucks et al.:
  energy balance at about 45 kcal/kg FFM in healthy young adults, and about 30 is the
  historical point where many systems are disrupted [13]. The 2023 IOC consensus focuses on
  *problematic* (long-lasting or severe) low EA and diagnoses REDs from symptoms, not from
  one EA cutoff [3]. The prior note says the consensus dropped the 30 kcal/kg FFM cutoff as a
  diagnosis; this session could only confirm the 2018 wording, so treat that as reported, not
  re-verified. **App result:** easy and lift days at ≈22.7 kcal/kg FFM on "lose", and the
  week averages ≈34. Short dips are not REDs, but repeating three sub-30 days every week of a
  high-volume block is the pattern the IOC warns about [3] (analysis).
- **Protein in a deficit.** 2.3–3.1 g/kg FFM, higher with leaner bodies and bigger deficits
  [5][6][8]. Another review gives ≈1.8–2.7 g/kg body weight [7]. A later meta-regression
  questions how firm the original range is (reported in the search index for [5], not read).
  The app's 186 g is ≈2.6 g/kg FFM at 15% body fat. **It matches.** No protein increase is
  needed for "lose".
- **Minimum fat.** The app's 20% floor (`lib/nutrition.ts:74,108`) matches ACSM [1].
  Bodybuilding prep goes as low as 15% [6], but that is not endurance guidance.

### 3. Weight gain

- **Surplus and rate.** Iraki et al. recommend a 10–20% surplus aimed at about 0.25–0.5%
  BW/week, smaller for advanced trainees, adjusted by the weekly trend [12]. With a meal plan
  at +506 kcal/day, elite athletes gained lean mass (+2.8%, and +4.4% at 12 months) [11].
  Elite athletes eating about 600 kcal/day more than an ad-libitum group gained more weight,
  but the extra was fat, not lean mass [10]. A 2022 review notes that 0.45 kg/week as mostly
  lean mass is hard to achieve [25]. **The app's +300 kcal (≈7%) sits just under the 10–20%
  band.** It is defensible for a runner who doesn't want to carry fat, and it lands near the
  bottom of the rate band once the +390/week baseline is included (analysis).
- **Carbs vs mixed.** No source found says the surplus must be carbs. For an endurance athlete
  carbs fit, but on double days the total reaches ≈9.9 g/kg (833 g), close to the "very high"
  band [1] (analysis). Protein at 2.2 g/kg is already ample; adding more is not needed.

### 4. Burn model and structure

- **Running cost.** Margaria's net cost of level running is ≈1 kcal/kg/km (0.97 in a later
  citation), regardless of speed [19]. Net cost added on top of RMR × activity factor is
  coherent. The small double count is that the activity factor also applies during the
  ~1.5–2 h of training: about 0.45 × 1,799 × 1.75/24 ≈ 60 kcal (analysis).
- **Lifting MET 5** is gross (it includes 1 MET of rest), so it overstates lifting by about
  84 kcal/h ≈ 100 kcal for 70 min (analysis; the MET value itself was not re-verified
  against the Compendium).
- **Resting equation.** In recreational athletes, Mifflin and Harris-Benedict were accurate in
  fewer than half of cases, and Cunningham, which is FFM-based, predicted best [15]. A study
  of male and female athletes found every equation under-predicted RMR, with Cunningham
  closest (≈−165 kcal) [16]. Katch-McArdle (used when body fat is entered,
  `lib/nutrition.ts:132`) is close in form to Cunningham (500 + 22 × FFM). That last point is
  analysis; Cunningham's coefficients are from memory and were not re-verified.
- **Net:** the overcounts (+60, +100) and the probable Mifflin undercount (−100 to −200)
  roughly cancel. The burn estimate is a reasonable centre, but it is not precise enough to
  steer a 150 kcal/day deficit. The weekly weight trend should calibrate it [8][12].
- **Structure.** Targets come from macros (`lib/nutrition.ts:98-102`), not from expenditure,
  so the energy balance depends on the template. For example, a week with 2 rest days and 1
  double puts maintenance below burn. "Lose" and "gain" are fixed kcal offsets
  (`:76-81,103-116`), not target rates, so the user never sees the weekly deficit or the
  expected rate. The 2022 Frontiers opinion also notes that what counts as "exercise" energy
  changes EA a lot [23], so any EA check should show its assumptions.

## Impact on the app

Recommended changes, in priority order. None are made yet.

1. **`lib/nutrition.ts:76-81, 103-112`: make "lose" rate-based with a weekly budget.**
   Replace the fixed `deficit` (100–1000 kcal on light days) with a target rate in % BW/week:
   default 0.5, range 0.25–1.0 [6][9][8]. Compute weekly deficit ≈ rate × kg × 7,700. Take it
   from rest and easy days first (fat to the 20% floor, then carbs). If that hits the EA floor
   in change 2, take the rest from **fat** on hard and double days, never carbs [4][21].
   *Reason:* today's 500 on 3 days gives ≈0.17%/week, and even the maximum can't reach 0.5%.
   Keep a legacy path for saved `deficit` values in `normalizeNutrition`
   (`lib/nutrition.ts:54`).
2. **New helper near `lib/nutrition.ts:139-145`: energy availability check.** Add
   `energyAvailability(intakeKcal, trainingKcal, ffmKg)`, with FFM from `bodyFat`, or else a
   clearly labelled assumed value. Use it to (a) floor each day's cut so EA stays ≥30 kcal/kg
   FFM and (b) flag weeks averaging under ~35–40 [13][3]. *Reason:* "lose" currently puts the
   lift days at ≈23. Show it as a soft warning, since the IOC does not diagnose REDs from an
   EA number [3].
3. **`lib/nutrition.ts:83-89` (`gearFor`) and `:58-63`: count lifting.** Either add a modest
   carb bump on lift days, e.g. +0.5 g/kg (analysis; no direct source for the size), or move
   easy + lift days to ~6 g/kg. *Reason:* these days hold 2+ h of training [1] and sit about
   480 kcal under burn. That shortfall is the root of both the maintenance skew and the low-EA
   cut.
4. **`lib/nutrition.ts:73, 101-102`: fat share by gear.** Use 20% on hard and double days and
   25% on rest and easy days (or fixed grams with the 20% floor). *Reason:* fat stays within
   ACSM's 20–35% [1], is lower where low-fat refuelling is advised [1][3], and brings hard and
   double days near burn. Worked example (analysis): double (9 g/kg, 20%) ≈4,720 vs burn
   4,580; hard (7.5, 20%) ≈4,090 vs 3,960–4,130; easy + lift (6 g/kg, 25%) ≈3,690 vs 3,940.
   Week ≈28,690 vs 28,790 burn, so balanced with each day within ~250 kcal.
5. **`lib/nutrition.ts:76-77, 113-116`: "gain" as a rate, and where it goes.** Express it as
   0.25–0.5% BW/week, default 0.25, starting near +10% of intake [12], with a soft cap around
   +500 kcal/day [10][11]. Put the surplus on rest, easy and lift days first, split between
   carbs and fat, instead of adding 75 g of carbs to every day. *Reason:* the current +300 is
   below the 10–20% band, and on double days it piles carbs to ≈9.9 g/kg.
6. **UI-facing (pure helper in `lib/`): weekly summary.** Return weekly intake, weekly burn,
   the difference, and the implied rate (kg and %BW per week) for the plan week. *Reason:*
   guidance recommends adjusting from the observed weekly trend [8][12], and the per-day burn
   is only an estimate [15][16].
7. **`lib/nutrition.ts:131-136`: resting equation.** When `bodyFat` is present, consider
   Cunningham, which performed best in athletes [15][16]. Without body fat, note that Mifflin
   likely under-reads by ~100–200 kcal for athletes [16]. Low priority, since the errors
   partly cancel.
8. **`lib/nutrition.ts:139`: lifting MET.** Use net (MET − 1) so it matches the net running
   cost and doesn't double-count resting energy. *Reason:* consistency (analysis); about
   100 kcal per session.

**Matches today:** the carb gear values (`:59-62`) fall within ACSM bands [1]. Protein 2.2 g/kg
(`:34`) suits both maintenance and a deficit [2][5][8]. The 1.8 g/kg hard-day floor (`:61`)
matches Kato [14]. The 20% fat floor (`:74`) matches ACSM [1]. Protecting hard and double days
when cutting (`:103-112`) matches the periodised "fuel for the work" approach [4][21]. The
double-day refuel helper (`:148-154`) is unchanged from the prior note.

## Open questions

- Body fat is unknown. All EA and FFM numbers assume 15%. At 20% body fat (FFM 67.4 kg), the
  easy-day EA on "lose" is ≈24 and the protein is ≈2.8 g/kg FFM.
- Gram amounts for lift-day carbs: not researched (glycogen use in a 40–70 min lifting session).
- Full texts of the 2016 joint position, Garthe 2011/2013 and IOC 2023 could not be opened
  (pubmed.ncbi.nlm.nih.gov and trainingpeaks.com were not reachable from this session). Figures
  come from abstracts and snippets in the search index. Garthe 2011 group numbers vary slightly
  between records.
- The 7,700 kcal/kg conversion is a rule of thumb (unsourced here) and overstates loss over
  months as expenditure adapts. Calibrate with the weight trend.
- No validated "kcal/kg/day" reference exists for non-elite male runners at about 100 km/week
  plus lifting. The DLW comparisons are small elite samples.
- Not covered: Precision Fuel & Hydration, Stryd, Runna, AIS fact sheets and mysportscience
  pages. Searches did not return their own pages on daily energy and weight change, so they
  are not cited.

## Sources

1. Thomas DT, Erdman KA, Burke LM, "Nutrition and Athletic Performance" (ACSM/AND/DC joint position), Med Sci Sports Exerc, 2016, https://pubmed.ncbi.nlm.nih.gov/26917108/
2. Jäger R et al., "ISSN Position Stand: protein and exercise", JISSN, 2017, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/
3. Mountjoy M et al., "2023 IOC consensus statement on Relative Energy Deficiency in Sport (REDs)", Br J Sports Med, 2023, https://pubmed.ncbi.nlm.nih.gov/37752011/
4. Impey SG et al., "Fuel for the Work Required", Sports Med, 2018, https://pubmed.ncbi.nlm.nih.gov/29453741/ (open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC5889771)
5. Helms ER et al., "A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes", IJSNEM, 2014, https://pubmed.ncbi.nlm.nih.gov/24092765/
6. Helms ER, Aragon AA, Fitschen PJ, "Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation", JISSN 11:20, 2014, https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492
7. "Considerations for protein intake in managing weight loss in athletes", 2015 (PubMed record; authors not verified in this session), https://pubmed.ncbi.nlm.nih.gov/25014731/
8. Aragon AA et al., "ISSN position stand: diets and body composition", JISSN 14:16, 2017, https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/
9. Garthe I et al., "Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes", IJSNEM 21(2):97-104, 2011, and 12-month follow-up; via Garthe's thesis record, https://nih.brage.unit.no/nih-xmlui/handle/11250/171332 and https://agris.fao.org/search/en/providers/122535/records/65df7eb30f3e94b9e5d93233
10. Garthe I et al., "Effect of nutritional intervention on body composition and performance in elite athletes", Eur J Sport Sci 13(3):295-303, 2013, https://pubmed.ncbi.nlm.nih.gov/23679146/
11. Garthe I et al., "Long-term effect of nutritional counselling on desired gain in body mass and lean body mass in elite athletes", Appl Physiol Nutr Metab, 2011, https://sponet.de/sponet/Record/4024460?lng=en
12. Iraki J et al., "Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review", Sports 7(7):154, 2019, https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710
13. Loucks AB, Kiens B, Wright HH, "Energy availability in athletes", J Sports Sci 29(S1):S7-S15, 2011, https://eclass.hmu.gr/modules/document/file.php/YD238/%CE%86%CF%81%CE%B8%CF%81%CE%B1%20%CE%91%CE%B8%CE%BB%CE%B7%CF%84%CE%B9%CE%BA%CE%AE%CF%82%20%CE%94%CE%B9%CE%B1%CF%84%CF%81%CE%BF%CF%86%CE%AE%CF%82/Energy%20availability%20in%20athletes.pdf
14. Kato H et al., "Protein Requirements Are Elevated in Endurance Athletes after Exercise as Determined by the Indicator Amino Acid Oxidation Method", PLoS One, 2016, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4913918/
15. ten Haaf T, Weijs PJM, "Resting Energy Expenditure Prediction in Recreational Athletes of 18–35 Years: Confirmation of Cunningham Equation and an Improved Weight-Based Alternative", PLoS One, 2014, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4183531/
16. "Accuracy of Resting Metabolic Rate Prediction Equations in Athletes", 2018 (PubMed record; read via search index only), https://pubmed.ncbi.nlm.nih.gov/28682934/
17. Fudge BW et al., "Evidence of negative energy balance using doubly labelled water in elite Kenyan endurance runners prior to competition", Br J Nutr, 2006, https://www.cambridge.org/core/journals/british-journal-of-nutrition/article/evidence-of-negative-energy-balance-using-doubly-labelled-water-in-elite-kenyan-endurance-runners-prior-to-competition/980A646864EF59DEBF2C7B8A8701C5CE
18. "Energy expenditure of elite female runners measured by respiratory chamber and doubly labeled water" (record), https://www.bisp-surf.de/Record/PU199405056126
19. Margaria R et al., "Energy cost of running", J Appl Physiol, 1963, https://pubmed.ncbi.nlm.nih.gov/13932993/
20. Fitzgerald M, "Rethinking the 60% Carbohydrates Rule", TrainingPeaks blog (secondary; page not opened, table values from the search index), https://www.trainingpeaks.com/blog/rethinking-the-60-percent-rule/
21. Stellingwerff T, Morton JP, Burke LM, "A framework for periodized nutrition for athletics", IJSNEM, 2019, https://acuresearchbank.acu.edu.au/download/d00e67ca0cd0f4b810d4281e95b54d3d48342b8014ce58cc5f486b9f1a5d8fa0/1025392/OA_Stellingwerff_2019_A_framework_for_periodized_nutrition_for.pdf
22. Jeukendrup AE, "Periodized Nutrition for Athletes", Sports Med, 2017, https://pmc.ncbi.nlm.nih.gov/articles/PMC5371625/
23. Opinion: energy availability and NEAT, Front Sports Act Living, 2022, https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.885631/full
24. (prior note) research/nutrition-endurance-runner.md, 2026-11-23
25. "Weight Gain Recommendations for Athletes and Military Personnel: a Critical Review of the Evidence", 2022, https://pubmed.ncbi.nlm.nih.gov/35233712/

## Implemented (2026-11-25)

Built in `lib/nutrition.ts` (`weekTargets`), with these differences from the recommendations above:
- Leftover cuts on hard and double days come from **carbs** down to the bottom of the report's
  band (7 and 8 g/kg), because their fat is already at the 20% floor.
- The light-day carb floor is 3 g/kg of **lean mass** (not body weight), so heavier people can
  still cut.
- With an estimated burn, the goal is aimed at the burn in both directions: if the maintenance
  week is already past the goal, food is added back (lose) or trimmed (gain).
- The surplus for Gain goes on rest and easy days first (not lift days specifically); no
  "+10% of intake" starting point.
- Saved fixed deficits (the old `deficit` setting) are dropped; Lose starts at 0.5%/week.
- Running stays at ~1 kcal/kg/km (a gross estimate); lifting uses net MET 4.
