-- Liberty Surveys - Expand Evergreen Polls Pool
-- Migration 003: Add more evergreen backup polls to prevent cycling
-- 
-- The original seed had only 3 evergreen polls, causing a 3-day rotation
-- when news-based generation fails. This migration adds 12 more topics
-- to provide at least 15 days of unique fallback content.

-- ============================================================================
-- ADDITIONAL EVERGREEN POLLS
-- ============================================================================
-- These cover timeless political topics that remain relevant regardless of 
-- current events. They are balanced to appeal across the political spectrum.

INSERT INTO evergreen_polls (id, question, options_json, briefing_background, briefing_conservative, briefing_liberal, briefing_centrist, category)
VALUES 
-- Healthcare & Social Programs
(
  '01EVERGREEN00000000004',
  'Should the federal government provide universal healthcare?',
  '[{"text":"Yes, implement a single-payer system"},{"text":"Yes, but through a public option alongside private insurance"},{"text":"No, healthcare should remain market-based"},{"text":"Undecided"}]',
  'The United States is the only developed nation without universal healthcare coverage. Approximately 27 million Americans lack health insurance. Healthcare spending accounts for nearly 18% of GDP, the highest among developed nations.',
  'A government-run healthcare system would reduce choice, increase wait times, and stifle medical innovation. The free market, with targeted reforms, can better deliver quality care while controlling costs through competition.',
  'Healthcare is a human right that should not depend on employment or income. A universal system would eliminate medical bankruptcies, reduce administrative costs, and ensure everyone has access to care.',
  'The debate centers on finding the right balance between government involvement and market mechanisms. Many support expanding coverage while preserving private options for those who prefer them.',
  'healthcare'
),
(
  '01EVERGREEN00000000005',
  'Should Social Security benefits be expanded, reduced, or restructured?',
  '[{"text":"Expanded - increase benefits and raise the payroll tax cap"},{"text":"Maintained - keep current structure with minor adjustments"},{"text":"Restructured - add private investment options"},{"text":"Reduced - means-test benefits to focus on those in need"}]',
  'Social Security provides retirement income to over 65 million Americans. The program faces long-term funding challenges, with the trust fund projected to be depleted by the mid-2030s without changes.',
  'Social Security faces insolvency without reform. Allowing workers to invest a portion of their contributions in private accounts would provide better returns and give individuals more control over their retirement.',
  'Social Security is a vital safety net that lifted millions of seniors out of poverty. Expanding benefits and removing the payroll tax cap on high earners would strengthen the program for future generations.',
  'Both sides agree the program needs attention. Solutions might include a combination of modest benefit adjustments, revenue increases, and raising the retirement age to reflect longer life expectancy.',
  'economy'
),

-- Immigration & Borders
(
  '01EVERGREEN00000000006',
  'Should the United States create a pathway to citizenship for undocumented immigrants?',
  '[{"text":"Yes, provide a clear pathway after meeting requirements"},{"text":"Yes, but only for those brought as children (DACA recipients)"},{"text":"No, enforce existing immigration laws first"},{"text":"No, undocumented immigrants should return to their home countries"}]',
  'An estimated 11 million undocumented immigrants live in the United States, many for decades. Congress has not passed comprehensive immigration reform since 1986, leaving millions in legal limbo.',
  'Amnesty rewards those who broke the law and encourages more illegal immigration. The priority should be border security, enforcing existing laws, and a merit-based legal immigration system.',
  'Most undocumented immigrants are hardworking people who contribute to communities and the economy. A pathway to citizenship would bring them out of the shadows and strengthen American society.',
  'A practical solution might combine enhanced border security with a lengthy pathway to legal status for those already here, requiring background checks, payment of back taxes, and learning English.',
  'immigration'
),
(
  '01EVERGREEN00000000007',
  'Should the U.S. government build additional physical barriers along the southern border?',
  '[{"text":"Yes, complete physical barriers across the entire border"},{"text":"Yes, but only in high-traffic areas combined with technology"},{"text":"No, focus resources on technology and personnel instead"},{"text":"No, walls are ineffective and wasteful"}]',
  'The U.S.-Mexico border spans nearly 2,000 miles, with varying terrain from deserts to rivers. Physical barriers currently exist along about 700 miles. Border apprehensions fluctuate based on various factors including economic conditions.',
  'Physical barriers are a proven deterrent that reduce illegal crossings and drug trafficking. Walls work in sectors where they have been built, and completing the barrier would enhance national security.',
  'Walls are expensive, environmentally destructive, and ineffective since most unauthorized immigrants overstay legal visas. Resources would be better spent on technology, judges, and addressing root causes of migration.',
  'Border security requires a comprehensive approach. Some areas may benefit from barriers while others are better served by technology, personnel, and cooperation with Mexico and Central American countries.',
  'immigration'
),

-- Gun Policy
(
  '01EVERGREEN00000000008',
  'Should the federal government implement stricter background check requirements for gun purchases?',
  '[{"text":"Yes, require universal background checks for all gun sales"},{"text":"Yes, close loopholes but preserve private sales between individuals"},{"text":"No, current background check requirements are sufficient"},{"text":"No, background checks infringe on Second Amendment rights"}]',
  'Federal law requires licensed firearms dealers to conduct background checks, but private sales at gun shows and online do not always require them. Studies disagree on the effectiveness of expanded checks.',
  'The Second Amendment protects individual gun rights. More background checks would burden law-abiding citizens while criminals will obtain guns illegally regardless. Enforce existing laws instead of adding new ones.',
  'Universal background checks have broad public support and would help keep guns out of dangerous hands. Closing the private sale loophole is a common-sense measure that respects responsible gun ownership.',
  'Most Americans support some form of improved background checks. The challenge is implementing them effectively while respecting gun rights and not creating undue burdens on lawful gun owners.',
  'safety'
),

-- Climate & Environment
(
  '01EVERGREEN00000000009',
  'Should the federal government set a deadline for phasing out fossil fuels?',
  '[{"text":"Yes, phase out within 10-15 years"},{"text":"Yes, but over a longer transition period (25-30 years)"},{"text":"No, let markets determine the energy transition"},{"text":"No, fossil fuels remain essential to the economy"}]',
  'The United States is the world''s largest oil and gas producer and second-largest carbon emitter. Renewable energy has grown significantly but still represents about 20% of electricity generation.',
  'Arbitrary deadlines would devastate the economy, eliminate millions of jobs, and increase energy costs for families. Clean energy should grow through innovation and market forces, not government mandates.',
  'Climate change poses an existential threat requiring urgent action. Setting clear deadlines would drive investment in clean energy, create jobs, and position America as a leader in the growing green economy.',
  'A gradual transition allows time for technology development and workforce retraining. Policies should balance environmental goals with economic realities and energy security concerns.',
  'environment'
),
(
  '01EVERGREEN00000000010',
  'Should the United States rejoin international climate agreements with binding emissions targets?',
  '[{"text":"Yes, with ambitious binding commitments"},{"text":"Yes, but with targets that protect American jobs"},{"text":"No, participate only in voluntary agreements"},{"text":"No, international agreements harm American competitiveness"}]',
  'The United States withdrew from the Paris Agreement in 2020 and rejoined in 2021. International climate agreements set varying levels of commitments, with debates over enforcement and fairness to developing nations.',
  'International agreements put American workers at a disadvantage while allowing major polluters like China to continue emitting. The U.S. should set its own environmental standards, not be bound by international bodies.',
  'Climate change is a global problem requiring global solutions. American leadership in international agreements is essential to hold other nations accountable and drive worldwide emissions reductions.',
  'International cooperation on climate is important, but agreements should be fair to American workers and include meaningful commitments from all major economies, not just developed nations.',
  'environment'
),

-- Economy & Taxes
(
  '01EVERGREEN00000000011',
  'Should the federal government raise taxes on corporations and high-income individuals?',
  '[{"text":"Yes, significantly increase taxes on both"},{"text":"Yes, but focus on closing loopholes rather than raising rates"},{"text":"No, keep current tax rates"},{"text":"No, reduce taxes to stimulate economic growth"}]',
  'The top federal income tax rate is currently 37%, down from historical highs of over 90%. The corporate tax rate was reduced from 35% to 21% in 2017. Tax policy debates center on fairness, growth, and deficit reduction.',
  'Higher taxes discourage investment, drive businesses overseas, and slow economic growth. Lower taxes allow job creators to expand and workers to keep more of their earnings.',
  'The wealthy and corporations should pay their fair share. Current tax policy favors the rich and increases inequality. Higher taxes would fund needed programs and reduce the deficit.',
  'Tax policy involves trade-offs between revenue, growth, and fairness. Many economists suggest a simpler code with fewer loopholes might be more effective than simply raising or lowering rates.',
  'economy'
),
(
  '01EVERGREEN00000000012',
  'Should the federal government forgive student loan debt?',
  '[{"text":"Yes, forgive all federal student loan debt"},{"text":"Yes, forgive a portion (e.g., up to $10,000-$50,000)"},{"text":"No, but reform the loan system for future borrowers"},{"text":"No, borrowers should repay what they agreed to"}]',
  'Americans hold approximately $1.75 trillion in student loan debt. Average debt for graduates exceeds $30,000. The cost of college has risen faster than inflation for decades, outpacing wage growth.',
  'Loan forgiveness is unfair to those who paid their debts or chose not to attend college. It would benefit higher earners and doesn''t address the root cause: rising college costs driven by government subsidies.',
  'Crushing student debt holds back a generation from buying homes, starting families, and building wealth. Forgiveness would stimulate the economy and correct for predatory lending practices.',
  'The focus should be on making college more affordable going forward while providing targeted relief for those most burdened. Universal forgiveness may be too broad and expensive.',
  'education'
),

-- Government & Democracy
(
  '01EVERGREEN00000000013',
  'Should the Electoral College be abolished in favor of a national popular vote?',
  '[{"text":"Yes, the president should be elected by popular vote"},{"text":"Yes, but allocate electoral votes proportionally by state"},{"text":"No, the Electoral College protects smaller states"},{"text":"No, the current system works as intended"}]',
  'The Electoral College was established by the Constitution as a compromise between election by Congress and direct popular vote. Five times in history, candidates have won the presidency while losing the popular vote.',
  'The Electoral College ensures all regions have a voice and prevents large population centers from dominating elections. It preserves federalism and forces candidates to build broad coalitions across diverse states.',
  'Every vote should count equally regardless of where someone lives. The Electoral College is an outdated system that can override the will of the majority and focuses campaigns on a few swing states.',
  'Both systems have merits. The debate involves balancing democratic principles with protecting minority interests and maintaining the federal structure established by the founders.',
  'governance'
),
(
  '01EVERGREEN00000000014',
  'Should the Supreme Court have term limits or a mandatory retirement age for justices?',
  '[{"text":"Yes, implement 18-year term limits"},{"text":"Yes, establish a mandatory retirement age (e.g., 75)"},{"text":"No, lifetime appointments ensure judicial independence"},{"text":"No, but reforms like court expansion should be considered"}]',
  'Supreme Court justices serve lifetime appointments, with average tenure increasing as lifespans extend. Other democracies typically have term limits or retirement ages for their highest courts.',
  'Lifetime appointments protect the Court from political pressure and ensure justices decide cases based on law, not popularity. Term limits would politicize the Court and undermine judicial independence.',
  'Life tenure makes Supreme Court appointments too consequential and political. Regular turnover through term limits would reduce partisan battles over nominations and better reflect evolving public values.',
  'The current system has benefits and drawbacks. Term limits could reduce political intensity around nominations while still preserving judicial independence if terms are long enough.',
  'governance'
),
(
  '01EVERGREEN00000000015',
  'Should there be stricter limits on money in political campaigns?',
  '[{"text":"Yes, overturn Citizens United and limit all political spending"},{"text":"Yes, but through disclosure requirements rather than spending limits"},{"text":"No, political spending is protected free speech"},{"text":"No, but require more transparency about donors"}]',
  'The Citizens United ruling in 2010 allowed unlimited independent political expenditures by corporations and unions. Campaign spending has increased dramatically, with billions spent in recent election cycles.',
  'Political spending is a form of protected speech. Limits on contributions restrict citizens'' ability to participate in democracy. Transparency, not restrictions, is the appropriate remedy for any concerns.',
  'Money in politics corrupts democracy and gives wealthy interests outsized influence. Strong limits on spending would level the playing field and make elections about ideas, not fundraising.',
  'Most agree the current system has problems but disagree on solutions. Enhanced disclosure might be a middle ground that preserves speech rights while increasing accountability.',
  'governance'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. IDs follow the same ULID-like format (01EVERGREEN0000000XXXX)
-- 2. Topics selected to be:
--    - Timeless (relevant regardless of current events)
--    - Balanced (legitimate positions on multiple sides)
--    - Diverse (covering different policy areas)
-- 3. Categories match existing: healthcare, economy, immigration, safety, 
--    environment, education, governance
-- 4. With original 3 + new 12 = 15 total evergreen polls
--    At 14-day exclusion window, this provides adequate variety
