-- ============================================================================
-- INVOk – seed data (idempotent).
-- Inserts the curriculum catalog + demo missions. NO personal data:
-- no real child names, no emails. Run AFTER 001_initial_schema.sql.
-- ============================================================================

-- --- Competencies -----------------------------------------------------------
insert into public.competencies
  (id, child_name, child_description, teacher_description, curriculum_framework, curriculum_area, curriculum_note, measurement_examples, icon)
values
  ('fact_detective', 'Detektív faktov', 'Overujem informácie a hľadám dôkazy, kým niečomu uverím.', 'Rozvíja kritické myslenie, mediálnu gramotnosť a prácu so zdrojmi.', 'ŠVP ZV SK', 'Prierezové gramotnosti / mediálna a občianska gramotnosť', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["overenie zdrojov tvrdenia","identifikácia manipulácie","argumentácia podložená dôkazmi"]'::jsonb, 'magnifier'),
  ('maker_venture', 'Tvorca riešení', 'Z nápadu spravím skutočné riešenie, prototyp alebo malú službu.', 'Rozvíja podnikavosť a iniciatívnosť: premena nápadu na realizovateľný výstup.', 'ŠVP ZV SK', 'Človek a svet práce / podnikavosť a tvorivosť', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["návrh konkrétneho riešenia","jednoduchý prototyp","zlepšenie po spätnej väzbe"]'::jsonb, 'lightbulb'),
  ('team_builder', 'Staviteľ tímu', 'Dohodnem si v tíme roly, držím slovo a pomáham riešiť nezhody.', 'Rozvíja sociálno-emocionálne zručnosti a štruktúrovanú spoluprácu.', 'ŠVP ZV SK', 'Sociálno-emocionálne učenie / spolupráca', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["rozdelenie rolí","dodržanie dohôd","tímová reflexia"]'::jsonb, 'people'),
  ('digital_navigator', 'Digitálny navigátor', 'Bezpečne sa pohybujem v digitálnom svete a tvorím v ňom obsah.', 'Rozvíja digitálnu gramotnosť a bezpečnosť, zodpovednú tvorbu obsahu.', 'ŠVP ZV SK', 'Digitálna gramotnosť / bezpečnosť online', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["bezpečné zaobchádzanie s údajmi","citovanie zdrojov","tvorba digitálneho výstupu"]'::jsonb, 'compass'),
  ('community_hero', 'Hrdina komunity', 'Pomáham svojmu okoliu a myslím na dopad riešenia na ľudí.', 'Rozvíja občiansku gramotnosť a etické uvažovanie.', 'ŠVP ZV SK', 'Občianska gramotnosť / hodnoty a komunita', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["prínos pre komunitu","etické zdôvodnenie","rešpekt k pravidlám"]'::jsonb, 'heart'),
  ('resource_guardian', 'Strážca zdrojov', 'Viem, že peniaze, čas aj materiál majú hodnotu, a neplytvám nimi.', 'Rozvíja finančnú gramotnosť a hospodárne myslenie.', 'ŠVP ZV SK', 'Finančná gramotnosť / hospodárenie', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["zostavenie rozpočtu","zdôvodnenie výdavkov","rozhodovanie v limite"]'::jsonb, 'coins'),
  ('planet_guardian', 'Ochranca planéty', 'Premýšľam, ako moje riešenie ovplyvní prírodu, a hľadám šetrnejšiu cestu.', 'Rozvíja environmentálnu gramotnosť a udržateľné uvažovanie.', 'ŠVP ZV SK', 'Environmentálna gramotnosť / udržateľnosť', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["dopad na prostredie","zníženie odpadu","udržateľné materiály"]'::jsonb, 'leaf'),
  ('self_captain', 'Kapitán svojho rastu', 'Poznám svoje silné stránky, pýtam si spätnú väzbu a plánujem ďalší krok.', 'Rozvíja metakogníciu a sebareguláciu.', 'ŠVP ZV SK', 'Sociálno-emocionálne učenie / sebareflexia', 'Interné mapovanie, nie priama citácia oficiálneho dokumentu.', '["sebareflexia po misii","stanovenie cieľa","naplnenie plánu rastu"]'::jsonb, 'star')
on conflict (id) do nothing;

-- --- Badges -----------------------------------------------------------------
insert into public.badges (id, name, description, icon, criteria, related_competency)
values
  ('first_step', 'Prvý krok', 'Odovzdal si svoju úplne prvú misiu.', 'rocket', 'Dokončenie prvej misie.', null),
  ('problem_mapper', 'Mapér problémov', 'Jasne si pomenoval skutočný problém vo svojom okolí.', 'map', 'Schválená misia zmapovania problému.', 'fact_detective'),
  ('solution_maker', 'Tvorca riešení', 'Z nápadu si spravil konkrétne riešenie.', 'lightbulb', 'Schválená misia s riešením.', 'maker_venture'),
  ('team_player', 'Tímový hráč', 'Spoľahlivo si ťahal za jeden povraz v tíme.', 'people', 'Dokončená tímová misia.', 'team_builder'),
  ('evidence_master', 'Majster dôkazov', 'Svoje tvrdenia si podložil silnými dôkazmi.', 'shield', 'Vysoké hodnotenie kritéria dôkazov.', 'fact_detective'),
  ('planet_friend', 'Priateľ planéty', 'Tvoje riešenie myslelo aj na prírodu.', 'leaf', 'Misia s ohľadom na prostredie.', 'planet_guardian'),
  ('reflective_mind', 'Reflexívna myseľ', 'Úprimne si sa zamyslel nad svojím rastom.', 'mirror', 'Dokončená reflexná misia.', 'self_captain'),
  ('streak_keeper', 'Vytrvalec', 'Dokončil si misie niekoľko období po sebe.', 'flame', 'Misie vo viacerých obdobiach po sebe.', null)
on conflict (id) do nothing;

-- --- Missions (published so they are readable under RLS) --------------------
insert into public.missions (id, title, story, goal, evidence_required, rubric, base_xp, difficulty, suggested_mode, status)
values
  ('map_school_problem', 'Zmapuj problém v škole', 'Každá veľká zmena sa začína tým, že si niekto všimne problém.', 'Nájdi a jasne pomenuj jeden konkrétny problém vo svojej škole.',
   '{"description":"Krátky popis problému: čo sa deje a koho sa to týka.","acceptedTypes":["text","image"]}'::jsonb,
   '[{"id":"clarity","label":"Jasnosť","description":"Problém je konkrétne pomenovaný."},{"id":"evidence","label":"Dôkazy","description":"Tvrdenie sa opiera o pozorovanie."},{"id":"impact","label":"Dopad","description":"Je jasné, koho sa problém týka."}]'::jsonb,
   80, 'easy', 'individual', 'published'),
  ('design_solution', 'Navrhni riešenie', 'Problém poznáš. Teraz si vynálezca.', 'Navrhni jedno realizovateľné riešenie a opíš jeho prvý krok.',
   '{"description":"Popis riešenia a prvého kroku.","acceptedTypes":["text","image","link"]}'::jsonb,
   '[{"id":"relevance","label":"Relevantnosť","description":"Týka sa pomenovaného problému."},{"id":"feasibility","label":"Realizovateľnosť","description":"Je v možnostiach žiaka/triedy."},{"id":"first_step","label":"Prvý krok","description":"Opísaný konkrétny prvý krok."}]'::jsonb,
   120, 'medium', 'individual', 'published'),
  ('test_solution', 'Over riešenie v triede', 'Dobrý nápad treba vyskúšať.', 'V tíme otestujte riešenie v malom a zaznamenajte výsledok.',
   '{"description":"Záznam z testu: čo ste skúsili a čo ste zistili.","acceptedTypes":["text","image"]}'::jsonb,
   '[{"id":"method","label":"Postup","description":"Test má jasný postup."},{"id":"teamwork","label":"Tímová práca","description":"Roly sú rozdelené a dodržané."},{"id":"findings","label":"Zistenia","description":"Výsledok je podložený pozorovaním."}]'::jsonb,
   150, 'medium', 'team', 'published'),
  ('mini_pitch', 'Priprav mini pitch', 'Najlepší nápad nepomôže, ak ho nikto nepochopí.', 'Priprav krátku prezentáciu, ktorá vysvetlí problém aj riešenie.',
   '{"description":"Osnova pitchu alebo digitálny plagát.","acceptedTypes":["text","image","link"]}'::jsonb,
   '[{"id":"structure","label":"Štruktúra","description":"Jasný začiatok, jadro a záver."},{"id":"clarity","label":"Zrozumiteľnosť","description":"Pochopiteľné aj zvonku."},{"id":"value","label":"Prínos","description":"Jasná hodnota riešenia."}]'::jsonb,
   140, 'medium', 'individual', 'published'),
  ('collect_feedback', 'Získaj spätnú väzbu', 'Spätná väzba je dar.', 'Získaj spätnú väzbu od aspoň troch ľudí a zhrň ju.',
   '{"description":"Zhrnutie spätnej väzby.","acceptedTypes":["text"]}'::jsonb,
   '[{"id":"openness","label":"Otvorenosť","description":"Prijíma aj kritickú spätnú väzbu."},{"id":"synthesis","label":"Zhrnutie","description":"Spätná väzba je zrozumiteľne zhrnutá."}]'::jsonb,
   90, 'easy', 'team', 'published'),
  ('improve_solution', 'Zlepši návrh', 'Skutoční tvorcovia svoj nápad vylepšujú.', 'Na základe spätnej väzby uprav riešenie a vysvetli zmenu.',
   '{"description":"Pôvodný stav, zmena a dôvod zmeny.","acceptedTypes":["text","image","link"]}'::jsonb,
   '[{"id":"iteration","label":"Iterácia","description":"Zmena vychádza zo spätnej väzby."},{"id":"reasoning","label":"Zdôvodnenie","description":"Žiak vysvetľuje dôvod zmeny."},{"id":"resourcefulness","label":"Hospodárnosť","description":"Zohľadňuje čas/materiál/náklady."}]'::jsonb,
   180, 'hard', 'individual', 'published'),
  ('reflect_growth', 'Reflektuj svoj rast', 'Cesta hrdinu sa končí poučením.', 'Napíš krátku reflexiu: čo sa podarilo, čo bolo ťažké, čo skúsiš nabudúce.',
   '{"description":"Osobná reflexia s aspoň jedným ďalším cieľom.","acceptedTypes":["text"]}'::jsonb,
   '[{"id":"honesty","label":"Úprimnosť","description":"Pomenúva aj to, čo bolo ťažké."},{"id":"specificity","label":"Konkrétnosť","description":"Ďalší cieľ je konkrétny."}]'::jsonb,
   100, 'easy', 'individual', 'published')
on conflict (id) do nothing;

-- --- Mission ↔ competency links --------------------------------------------
insert into public.mission_competencies (mission_id, competency_id, weight)
values
  ('map_school_problem', 'fact_detective', 1),
  ('map_school_problem', 'community_hero', 1),
  ('design_solution', 'maker_venture', 1),
  ('design_solution', 'self_captain', 1),
  ('test_solution', 'maker_venture', 1),
  ('test_solution', 'team_builder', 1),
  ('test_solution', 'fact_detective', 1),
  ('mini_pitch', 'digital_navigator', 1),
  ('mini_pitch', 'self_captain', 1),
  ('mini_pitch', 'maker_venture', 1),
  ('collect_feedback', 'team_builder', 1),
  ('collect_feedback', 'self_captain', 1),
  ('improve_solution', 'maker_venture', 1),
  ('improve_solution', 'self_captain', 1),
  ('improve_solution', 'resource_guardian', 1),
  ('reflect_growth', 'self_captain', 1)
on conflict (mission_id, competency_id) do nothing;
