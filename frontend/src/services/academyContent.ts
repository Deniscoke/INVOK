/**
 * INVOK Akadémia — static course content (no DB). Modules → lessons → video + a
 * short quiz. Lessons with `videoUrl: null` are "coming soon". Easy to extend:
 * add lessons/modules here, drop the video in the `academy` Storage bucket.
 */
export interface AcademyQuizQuestion {
  q: string;
  options: string[];
  /** index of the correct option */
  correct: number;
}

export interface AcademyLesson {
  id: string;
  title: string;
  description: string;
  /** public video URL, or null when not produced yet */
  videoUrl: string | null;
  durationLabel: string;
  quiz: AcademyQuizQuestion[];
  xp: number;
}

export interface AcademyModule {
  id: string;
  title: string;
  emoji: string;
  /** mapped competency / badge (for cohesion with the rest of INVOK) */
  badge: string;
  lessons: AcademyLesson[];
}

const SUPABASE_PUBLIC = 'https://uydxclysmyyxyygewdot.supabase.co/storage/v1/object/public/academy';

export const ACADEMY_MODULES: readonly AcademyModule[] = [
  {
    id: 'm1',
    title: 'Podnikavosť a inovácie',
    emoji: '\u{1F4A1}',
    badge: 'Inovátor školy',
    lessons: [
      {
        id: 'm1l1',
        title: 'Prečo niektorí menia svet a iní sa len sťažujú?',
        description: 'Čo je problém, čo je príležitosť a ako vznikajú dobré nápady. So Smartou ako sprievodkyňou.',
        videoUrl: `${SUPABASE_PUBLIC}/modul1/lekcia1-720.mp4`,
        durationLabel: '1:02',
        xp: 30,
        quiz: [
          {
            q: 'Čo je „príležitosť"?',
            options: [
              'Problém, ktorý nikoho netrápi',
              'Ten istý problém — len otočený na „čo s tým môžem urobiť ja"',
              'Niečo, čo sa vôbec nedá ovplyvniť',
            ],
            correct: 1,
          },
          {
            q: 'Odkiaľ podľa videa prichádzajú dobré nápady?',
            options: [
              'Padajú z neba samé od seba',
              'Keď si všímaš okolie a pýtaš sa „prečo?" a „čo keby?"',
              'Len od dospelých expertov',
            ],
            correct: 1,
          },
          {
            q: 'Aký je tvoj prvý krok k vlastnému projektu?',
            options: [
              'Počkať, kým to vyrieši niekto iný',
              'Sťažovať sa na internete',
              'Všimnúť si, čo ťa v škole najviac štve',
            ],
            correct: 2,
          },
        ],
      },
    ],
  },
  { id: 'm2', title: 'Kritické a mediálne myslenie', emoji: '\u{1F50D}', badge: 'Lovec hoaxov', lessons: [] },
  { id: 'm3', title: 'Tímová spolupráca', emoji: '\u{1F91D}', badge: 'Tímový stratég', lessons: [] },
  { id: 'm4', title: 'Komunikácia a prezentácia', emoji: '\u{1F3A4}', badge: 'Mladý rečník', lessons: [] },
];

export function findLesson(lessonId: string): { module: AcademyModule; lesson: AcademyLesson } | null {
  for (const module of ACADEMY_MODULES) {
    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return null;
}
