-- Liberty Surveys - More Evergreen Polls
-- Migration 004: Add 15 more evergreen backup polls (ids 16-30)
-- Total after this migration: 30 evergreen polls

INSERT INTO evergreen_polls (id, question, options_json, briefing_background, briefing_conservative, briefing_liberal, briefing_centrist, category)
VALUES 
(
  '01EVERGREEN00000000016',
  'Should federal funding for police departments be increased, maintained, or redirected?',
  '[{"text":"Increase funding for police departments"},{"text":"Maintain current funding levels"},{"text":"Redirect some funding to social services"},{"text":"Significantly reduce police funding"},{"text":"Undecided"}]',
  'Police department budgets vary widely across jurisdictions and typically consume a significant portion of municipal budgets. Debates about policing have intensified following high-profile incidents. Some cities have experimented with alternative response models for mental health and other non-violent calls.',
  'Police are essential for public safety and deserve adequate resources and support. Defunding leads to increased crime and endangers communities. Reform efforts should focus on training and community partnerships while maintaining strong law enforcement capability.',
  'Current policing models often fail vulnerable communities. Investing in mental health services, housing, education, and community programs can address root causes of crime more effectively. Police budgets should be reallocated to these proven approaches.',
  'Public safety requires both effective policing and addressing underlying social issues. A balanced approach might maintain core police functions while investing in specialized response teams for mental health crises and expanding community-based prevention programs.',
  'criminal_justice'
),
(
  '01EVERGREEN00000000017',
  'Should colleges and universities be allowed to consider race in admissions decisions?',
  '[{"text":"Yes, race should be one of many factors"},{"text":"Yes, but only to remedy documented discrimination"},{"text":"No, admissions should be race-blind"},{"text":"Undecided"}]',
  'Affirmative action in college admissions has been debated for decades. The Supreme Court has issued multiple rulings on what considerations are permissible. Supporters argue it promotes diversity; opponents argue it constitutes discrimination. Alternative approaches include socioeconomic-based preferences.',
  'Admissions should be based on merit, not race. Race-conscious policies are discriminatory and unconstitutional. They stigmatize the groups they claim to help and violate the principle of equal treatment. Socioeconomic diversity can be achieved through race-neutral means.',
  'Centuries of discrimination have created persistent inequalities that race-neutral policies cannot address. Diversity benefits all students educationally. Affirmative action remains necessary to provide equal opportunity and remedy ongoing systemic barriers.',
  'Achieving diversity and equal opportunity are worthy goals, but the means matter. Approaches that consider socioeconomic factors, first-generation status, and geographic diversity might achieve similar benefits while avoiding the legal and ethical concerns of racial classifications.',
  'education'
),
(
  '01EVERGREEN00000000018',
  'Should marijuana be legalized at the federal level?',
  '[{"text":"Yes, fully legal for recreational use"},{"text":"Yes, but only for medical use"},{"text":"No, but decriminalize possession"},{"text":"No, maintain current federal prohibition"}]',
  'Marijuana remains a Schedule I controlled substance under federal law, though many states have legalized medical or recreational use. This creates conflicts between state and federal law. Cannabis is the most commonly used federally illegal drug in the United States.',
  'Marijuana is a gateway drug that harms public health, especially among youth. Legalization increases usage, impaired driving, and workplace accidents. Federal standards should protect public safety rather than enable an industry profiting from addiction.',
  'Prohibition has failed, resulting in mass incarceration that disproportionately affects communities of color. Legal regulation is safer than black markets. Tax revenue can fund education and treatment. Adults should have the freedom to make their own choices.',
  'The current patchwork of state and federal laws creates confusion and inconsistency. A federal framework that allows state experimentation while establishing safety standards, age limits, and impaired driving rules might balance competing concerns.',
  'criminal_justice'
),
(
  '01EVERGREEN00000000019',
  'Should the death penalty be abolished in the United States?',
  '[{"text":"Yes, abolish it completely"},{"text":"Yes, except for terrorism or mass murder"},{"text":"No, but limit its use to the most severe crimes"},{"text":"No, maintain or expand its use"}]',
  'The United States is among the few developed nations that retains capital punishment. Currently, 27 states have the death penalty. Execution methods, wrongful convictions, racial disparities, and costs are ongoing subjects of debate. Several states have recently abolished or paused executions.',
  'The death penalty provides justice for the most heinous crimes and closure for victims families. It serves as the ultimate deterrent. Those who commit the worst offenses forfeit their right to life. The system has safeguards to prevent wrongful execution.',
  'The death penalty is irreversible, and innocent people have been executed. It is applied disproportionately based on race and wealth. It costs more than life imprisonment and does not deter crime. The state should not have the power to take lives.',
  'Capital punishment raises profound moral, practical, and legal questions. Ensuring fairness and accuracy in its application has proven difficult. Whether kept or abolished, the justice system must prioritize both public safety and protection of the innocent.',
  'criminal_justice'
),
(
  '01EVERGREEN00000000020',
  'Should the federal government regulate large technology companies more strictly?',
  '[{"text":"Yes, break up the largest tech companies"},{"text":"Yes, but focus on privacy and content rules"},{"text":"No, current regulations are sufficient"},{"text":"No, reduce regulations to encourage innovation"}]',
  'A handful of technology companies dominate search, social media, e-commerce, and cloud computing. Debates focus on antitrust concerns, data privacy, content moderation, and their influence on public discourse. Both parties have expressed concerns, though they emphasize different issues.',
  'Big tech companies censor conservative voices and viewpoints. However, government regulation of speech is dangerous. The focus should be on ending viewpoint discrimination, increasing transparency, and preventing anticompetitive behavior without expanding government control.',
  'Tech monopolies stifle competition, exploit user data, and spread misinformation. Strong regulation and antitrust enforcement are needed to protect privacy, ensure fair competition, and require accountability for harmful content on their platforms.',
  'Technology regulation must balance innovation, free speech, competition, and consumer protection. Targeted rules addressing specific harms like privacy violations or anticompetitive practices may be more effective than broad interventions.',
  'economy'
),
(
  '01EVERGREEN00000000021',
  'Should the federal government regulate cryptocurrencies more strictly?',
  '[{"text":"Yes, strict regulation like traditional securities"},{"text":"Yes, but with rules tailored to digital assets"},{"text":"No, minimal regulation to encourage innovation"},{"text":"No, ban cryptocurrencies entirely"}]',
  'Cryptocurrencies have grown from a niche technology to a trillion-dollar market. Regulatory agencies have debated jurisdiction and classification. Concerns include consumer protection, fraud, money laundering, and environmental impact. Other countries have taken varied approaches from bans to adoption.',
  'Excessive regulation would stifle innovation and drive this industry overseas. Cryptocurrency represents financial freedom from government control and central bank manipulation. Smart, light-touch regulation can address fraud without destroying the industrys potential.',
  'The cryptocurrency space is rife with fraud, speculation, and environmental harm. Lack of regulation has harmed consumers and enabled illegal activity. Clear rules that protect investors and ensure accountability are overdue.',
  'Digital assets present novel regulatory challenges that existing frameworks may not address well. A balanced approach providing consumer protection and preventing illicit use while allowing legitimate innovation requires thoughtful, technology-informed rules.',
  'economy'
),
(
  '01EVERGREEN00000000022',
  'Should federal spending on space exploration be increased?',
  '[{"text":"Yes, significantly increase NASA funding"},{"text":"Yes, but partner more with private companies"},{"text":"No, maintain current levels"},{"text":"No, redirect funding to other priorities"}]',
  'NASA receives about 0.5% of the federal budget, down from over 4% during the Apollo era. Private companies have become major players in space. Debates continue about the value of human versus robotic exploration, and Moon versus Mars priorities. Space technology has produced many civilian applications.',
  'Space exploration drives innovation, creates jobs, and maintains American leadership. Competition from China makes investment urgent. Private sector partnerships increase efficiency. National prestige and technological advancement justify expanded investment.',
  'With pressing needs on Earth including poverty, healthcare, and climate change, billions on space exploration are hard to justify. Private companies can handle commercial space activities. Public funds should prioritize problems affecting people today.',
  'Space exploration has produced valuable scientific knowledge and technological spinoffs. A balanced approach might focus NASA on fundamental research and deep space exploration while leveraging private industry for routine operations, potentially achieving more with similar budgets.',
  'economy'
),
(
  '01EVERGREEN00000000023',
  'Should the United States expand its use of nuclear energy?',
  '[{"text":"Yes, significantly expand nuclear power"},{"text":"Yes, but focus on newer, safer technologies"},{"text":"No, phase out existing nuclear plants"},{"text":"Undecided"}]',
  'Nuclear power provides about 20% of U.S. electricity and half of its carbon-free power. Plants are aging, with few new ones under construction. Next-generation designs promise improved safety and reduced waste. Nuclear faces concerns about safety, waste storage, cost, and proliferation.',
  'Nuclear energy is clean, reliable, and essential for energy security. Modern designs are extremely safe. Irrational fear has blocked this proven technology. Expanding nuclear is necessary to meet energy needs and climate goals without destroying the economy.',
  'Nuclear power is too expensive, too slow to build, and creates dangerous waste that remains hazardous for thousands of years. Accident risks, while rare, are catastrophic. Renewable energy with storage can meet needs more safely and economically.',
  'Nuclear energy offers reliable, low-carbon power but comes with legitimate concerns. Next-generation designs may address safety and waste issues. Including nuclear in an all-of-the-above energy strategy might help achieve reliability and emissions goals.',
  'environment'
),
(
  '01EVERGREEN00000000024',
  'Should the federal government mandate paid family and medical leave?',
  '[{"text":"Yes, at least 12 weeks paid leave"},{"text":"Yes, but let employers set terms"},{"text":"No, leave policies should be voluntary"},{"text":"Undecided"}]',
  'The United States is the only developed nation without guaranteed paid parental leave. The Family and Medical Leave Act provides 12 weeks of unpaid leave but many workers are not eligible. Some states and companies offer paid leave. Debates focus on worker welfare, business costs, and economic competitiveness.',
  'Mandated leave increases costs for businesses, especially small employers, leading to fewer jobs and lower wages. Companies already compete for workers by offering benefits. Government mandates are one-size-fits-all solutions that ignore diverse business needs.',
  'Paid leave is essential for family wellbeing, gender equality, and child development. The U.S. lags behind every other developed nation. Workers should not have to choose between caring for family and economic security. Businesses benefit from retention and productivity.',
  'Supporting families and maintaining economic competitiveness are both valid goals. A flexible federal framework with small business accommodations, tax credits, or insurance mechanisms might provide baseline support while minimizing adverse business impacts.',
  'economy'
),
(
  '01EVERGREEN00000000025',
  'Should voters be required to show photo identification to cast a ballot?',
  '[{"text":"Yes, government-issued photo ID required"},{"text":"Yes, but provide free IDs to all voters"},{"text":"No, current verification methods are sufficient"},{"text":"Undecided"}]',
  'Voter ID requirements vary widely by state. Supporters argue ID requirements protect election integrity. Opponents argue they disproportionately burden minority, elderly, and low-income voters who are less likely to have ID. Studies disagree on both the prevalence of fraud and the impact on turnout.',
  'Photo ID requirements are common-sense measures that protect the integrity of elections. You need ID to fly, buy alcohol, or enter government buildings. Claims of suppression are exaggerated. Confidence in elections requires basic verification.',
  'Strict voter ID laws are a solution in search of a problem. In-person voter fraud is extremely rare. These laws are designed to make voting harder for minorities, the elderly, students, and the poor. They are modern-day voter suppression.',
  'Both election integrity and voting access are important values. ID requirements paired with proactive efforts to ensure all eligible voters can easily obtain free identification might balance security concerns with access, though implementation details matter significantly.',
  'elections'
),
(
  '01EVERGREEN00000000026',
  'Should the United States increase or decrease its military spending?',
  '[{"text":"Increase defense spending significantly"},{"text":"Maintain current spending levels"},{"text":"Modestly decrease defense spending"},{"text":"Significantly decrease defense spending"}]',
  'The United States spends more on its military than the next ten countries combined. Defense spending is about 3% of GDP, down from Cold War levels. Debates involve the balance between defense needs, other spending priorities, and deficit concerns. Geopolitical competition has intensified.',
  'A strong military deters aggression and protects American interests. Threats from China, Russia, and others require sustained investment. Military strength is the foundation of diplomacy. Cutting defense in a dangerous world invites conflict.',
  'The defense budget is bloated with waste and unnecessary weapons systems. Military spending crowds out investments in education, healthcare, and infrastructure. Diplomacy and international cooperation are more effective than military force in most situations.',
  'National security requires adequate defense capabilities, but efficiency matters. Regular review of military needs, elimination of wasteful programs, and strategic investment in emerging threats might allow both fiscal responsibility and strong defense.',
  'foreign_policy'
),
(
  '01EVERGREEN00000000027',
  'Should reducing the national debt be a top federal priority?',
  '[{"text":"Yes, cut spending to balance the budget"},{"text":"Yes, but through a mix of spending cuts and revenue increases"},{"text":"No, focus on investment and growth first"},{"text":"Undecided"}]',
  'The U.S. national debt exceeds $30 trillion and continues to grow. Interest payments consume an increasing share of the federal budget. Economists disagree on the urgency and appropriate response. Debt as a percentage of GDP is at historically high levels outside wartime.',
  'The national debt is a crisis that burdens future generations. Out-of-control spending must be reined in. Balanced budgets require spending discipline, not tax increases that would slow economic growth. Entitlement reform is essential.',
  'Deficit concerns are often used to block needed investments. Low interest rates have made debt manageable. Focusing on growth, jobs, and needed programs is more important than arbitrary deficit targets. Tax increases on the wealthy can help.',
  'Long-term fiscal sustainability matters, but so does near-term economic performance. A gradual path to stabilizing debt through a combination of economic growth, revenue adjustments, and spending restraint may be more realistic than abrupt changes.',
  'economy'
),
(
  '01EVERGREEN00000000028',
  'Should ranked-choice voting be adopted for federal elections?',
  '[{"text":"Yes, implement ranked-choice voting nationally"},{"text":"Yes, but let states decide"},{"text":"No, keep the current plurality voting system"},{"text":"Undecided"}]',
  'Ranked-choice voting allows voters to rank candidates by preference. If no candidate receives a majority, the last-place candidate is eliminated and their votes redistributed until someone wins a majority. Some jurisdictions have adopted it. Studies examine effects on polarization, third parties, and voter experience.',
  'Ranked-choice voting is confusing, leads to more spoiled ballots, and can produce outcomes that contradict voter preferences. The current system is simple and has served the nation well. Changes to voting methods should be made cautiously, if at all.',
  'Ranked-choice voting reduces negative campaigning, ensures majority support for winners, and gives voters more choices. It would break the two-party duopoly and reduce the spoiler effect that punishes voting for third-party candidates.',
  'Electoral system design involves complex tradeoffs. Ranked-choice voting addresses some concerns about the current system but introduces new complexities. Pilot programs at local and state levels can help evaluate whether benefits outweigh challenges.',
  'elections'
),
(
  '01EVERGREEN00000000029',
  'Should states be able to pass right-to-work laws prohibiting mandatory union membership?',
  '[{"text":"Yes, workers should choose whether to join unions"},{"text":"Yes, but require non-members to pay for representation"},{"text":"No, unions should be able to require membership"},{"text":"Undecided"}]',
  'Right-to-work laws prohibit agreements requiring employees to join or pay dues to unions as a condition of employment. Currently, 27 states have such laws. Supporters argue they protect worker freedom. Opponents argue they weaken unions and reduce worker bargaining power.',
  'Workers should not be forced to pay dues to organizations they may disagree with. Right-to-work laws attract businesses, create jobs, and protect individual freedom. Unions can still organize and bargain without compulsory membership.',
  'Right-to-work laws are designed to weaken unions and reduce worker power. They allow free-riders who benefit from union representation without contributing. Strong unions built the middle class, and weakening them has contributed to inequality.',
  'Labor policy involves balancing worker freedom, collective bargaining power, and economic competitiveness. Fair-share fees that cover representation costs without funding political activities might address free-rider concerns while respecting objectors.',
  'economy'
),
(
  '01EVERGREEN00000000030',
  'Should the federal government establish regulations for artificial intelligence development?',
  '[{"text":"Yes, comprehensive regulations before deployment"},{"text":"Yes, but limited to high-risk applications"},{"text":"No, let the industry self-regulate"},{"text":"Undecided"}]',
  'Artificial intelligence is rapidly advancing across many sectors. Concerns include job displacement, algorithmic bias, privacy, autonomous weapons, and existential risks. The U.S. currently has no comprehensive AI regulation, though some sector-specific rules exist. Other nations and the EU are developing AI governance frameworks.',
  'Heavy-handed regulation will stifle innovation and cede AI leadership to China and other competitors. Industry is best positioned to develop appropriate safeguards. Government should focus on existing laws and targeted guidance rather than sweeping new rules.',
  'AI systems are making consequential decisions about employment, healthcare, criminal justice, and more with inadequate oversight. Algorithmic bias perpetuates discrimination. Strong regulation is needed to protect rights and ensure AI benefits society broadly.',
  'AI governance is an emerging challenge that requires balancing innovation, safety, and rights. A risk-based approach focusing regulations on high-stakes applications while allowing flexibility in lower-risk areas might achieve this balance as the technology evolves.',
  'economy'
)
ON CONFLICT (id) DO NOTHING;
