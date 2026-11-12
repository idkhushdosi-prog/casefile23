export type DiagramArea =
  | 'head'
  | 'eyes'
  | 'ears'
  | 'brain'
  | 'mouth'
  | 'shoulders'
  | 'hands'
  | 'pocket'
  | 'bag'
  | 'stomach'
  | 'feet'
  | 'shoes';

export type PromptGroup =
  | 'Body and habits'
  | 'Pockets, bags and belongings'
  | 'Food and fuel'
  | 'Time and place'
  | 'Wildcards';

export interface DiagramPrompt {
  id: string;
  group: PromptGroup;
  area: DiagramArea;
  text: string;
  example?: string;
}

export const DIAGRAM_AREAS: Record<DiagramArea, { label: string; x: number; y: number }> = {
  head: { label: 'Head & Hair', x: 50, y: 11 },
  brain: { label: 'Brain', x: 60, y: 16 },
  eyes: { label: 'Eyes', x: 42, y: 19 },
  ears: { label: 'Ears', x: 66, y: 22 },
  mouth: { label: 'Mouth & Voice', x: 50, y: 26 },
  shoulders: { label: 'Shoulders & Posture', x: 30, y: 34 },
  bag: { label: 'School Bag', x: 76, y: 42 },
  hands: { label: 'Hands & Pen', x: 22, y: 52 },
  stomach: { label: 'Stomach', x: 50, y: 48 },
  pocket: { label: 'Pocket & Blazer', x: 64, y: 57 },
  feet: { label: 'Legs & Feet', x: 42, y: 78 },
  shoes: { label: 'Shoes', x: 58, y: 91 },
};

export const DIAGRAM_PROMPTS: readonly DiagramPrompt[] = [
  // Body and habits (18)
  { id: 'dp_eyes_always', group: 'Body and habits', area: 'eyes', text: 'Their eyes are always...', example: 'scanning for the teacher\'s footsteps' },
  { id: 'dp_eyes_test', group: 'Body and habits', area: 'eyes', text: 'Their eyes during a surprise test look like...', example: 'a deer staring at board-exam headlights' },
  { id: 'dp_hands_always', group: 'Body and habits', area: 'hands', text: 'Their hands are always...', example: 'tapping an imaginary tabla on the desk' },
  { id: 'dp_hands_pen', group: 'Body and habits', area: 'hands', text: 'Their pen is always...', example: 'chewed at the cap and borrowed from someone else' },
  { id: 'dp_ears_hear', group: 'Body and habits', area: 'ears', text: 'Their ears only hear...', example: 'the sound of a foil wrap opening three rows away' },
  { id: 'dp_ears_selective', group: 'Body and habits', area: 'ears', text: 'Their ears immediately tune out when...', example: 'someone says "Open your homework register"' },
  { id: 'dp_brain_perm', group: 'Body and habits', area: 'brain', text: 'Their brain is permanently...', example: 'playing one 2012 Bollywood chorus on loop' },
  { id: 'dp_brain_ram', group: 'Body and habits', area: 'brain', text: '90% of their brain storage is occupied by...', example: 'useless memes and canteen prices' },
  { id: 'dp_face_test', group: 'Body and habits', area: 'head', text: 'Their face during a surprise test looks like...', example: 'loading screen stuck at 12%' },
  { id: 'dp_posture', group: 'Body and habits', area: 'shoulders', text: 'Their posture is that of...', example: 'a shrimp reading a 600-page textbook' },
  { id: 'dp_walk', group: 'Body and habits', area: 'feet', text: 'Their walk down the corridor is...', example: 'power-walking like they own the CBSE board' },
  { id: 'dp_laugh', group: 'Body and habits', area: 'mouth', text: 'Their laugh sounds like...', example: 'a diesel auto refusing to start in winter' },
  { id: 'dp_voice_act', group: 'Body and habits', area: 'mouth', text: 'Their voice only activates when...', example: 'free period or gossip is announced' },
  { id: 'dp_sleep_pos', group: 'Body and habits', area: 'head', text: 'Their sleeping position in class is...', example: 'chin propped on fist, eyes 15% open' },
  { id: 'dp_shoulders', group: 'Body and habits', area: 'shoulders', text: 'Their shoulders carry...', example: 'a bag heavier than our syllabus and zero stress' },
  { id: 'dp_left_foot', group: 'Body and habits', area: 'feet', text: 'Their left foot is always...', example: 'already pointed toward the exit before the bell' },
  { id: 'dp_hair', group: 'Body and habits', area: 'head', text: 'Their hair is always...', example: 'surviving three ceiling fans at speed 5' },
  { id: 'dp_sigh', group: 'Body and habits', area: 'mouth', text: 'Their sigh means...', example: '"Why did I wake up for this double period?"' },

  // Pockets, bags and belongings (15)
  { id: 'dp_pocket_contains', group: 'Pockets, bags and belongings', area: 'pocket', text: 'Their pocket always contains...', example: '3 stolen pens and 1 crumpled canteen receipt' },
  { id: 'dp_pocket_secret', group: 'Pockets, bags and belongings', area: 'pocket', text: 'Inside their blazer pocket lives...', example: 'emergency Center Fruit and dead earphones' },
  { id: 'dp_bag_secret', group: 'Pockets, bags and belongings', area: 'bag', text: 'Their bag secretly contains...', example: 'two textbooks from 10th grade and 47 loose sheets' },
  { id: 'dp_bag_weight', group: 'Pockets, bags and belongings', area: 'bag', text: 'Their bag weighs 8 kg because of...', example: 'pure emotional baggage and 1 single notebook' },
  { id: 'dp_desk_holds', group: 'Pockets, bags and belongings', area: 'hands', text: 'Their desk always holds...', example: 'a half-built pen tower and doodles from October' },
  { id: 'dp_notebook_mostly', group: 'Pockets, bags and belongings', area: 'hands', text: 'Their notebook is mostly...', example: 'blank after page 4, then suddenly 20 pages of calligraphy' },
  { id: 'dp_water_bottle', group: 'Pockets, bags and belongings', area: 'bag', text: 'Their water bottle contains...', example: 'echoes, because they drink everyone else\'s' },
  { id: 'dp_id_card', group: 'Pockets, bags and belongings', area: 'pocket', text: 'Their ID card is always...', example: 'tucked in their pocket until the gate guard looks' },
  { id: 'dp_handwriting', group: 'Pockets, bags and belongings', area: 'hands', text: 'Their handwriting looks like...', example: 'an ECG monitor during a fire drill' },
  { id: 'dp_shoes_survived', group: 'Pockets, bags and belongings', area: 'shoes', text: 'Their shoes have survived...', example: 'two monsoons, four PT periods, and zero polish' },
  { id: 'dp_shoes_squeak', group: 'Pockets, bags and belongings', area: 'shoes', text: 'Their shoes announce their arrival by...', example: 'scuffing loudly through silent corridors' },
  { id: 'dp_uniform', group: 'Pockets, bags and belongings', area: 'shoulders', text: 'Their uniform always has...', example: 'a mysteriously loose tie by 9:15 AM' },
  { id: 'dp_geometry_box', group: 'Pockets, bags and belongings', area: 'bag', text: 'Their geometry box actually holds...', example: 'zero compasses, 5 broken nibs, and old wrappers' },
  { id: 'dp_last_page', group: 'Pockets, bags and belongings', area: 'hands', text: 'The last page of their notebook has...', example: 'FLAMES scores, tic-tac-toe, and fake signatures' },
  { id: 'dp_borrows_never', group: 'Pockets, bags and belongings', area: 'pocket', text: 'The item hiding in their pencil pouch is...', example: 'every blue Reynolds pen you ever lost' },

  // Food and fuel (7)
  { id: 'dp_stomach_runs', group: 'Food and fuel', area: 'stomach', text: 'Their stomach runs on...', example: 'samosas, cold Maggi, and sheer audacity' },
  { id: 'dp_tiffin_gone', group: 'Food and fuel', area: 'stomach', text: 'Their tiffin is gone by...', example: 'second period, eaten in secret behind the blazer' },
  { id: 'dp_canteen_order', group: 'Food and fuel', area: 'stomach', text: 'Their canteen order is always...', example: 'one patty and "bhaiya thoda chutney aur"' },
  { id: 'dp_lecture_snack', group: 'Food and fuel', area: 'mouth', text: 'Their snack of choice during a lecture is...', example: 'smuggled Mentos passed under the bench' },
  { id: 'dp_hungry_radar', group: 'Food and fuel', area: 'stomach', text: 'Their hunger radar activates when...', example: 'someone unzips a foil-wrapped aloo paratha' },
  { id: 'dp_hydration', group: 'Food and fuel', area: 'mouth', text: 'Their excuse to go drink water is...', example: 'an Olympic-level detour past three other classrooms' },
  { id: 'dp_tiffin_tax', group: 'Food and fuel', area: 'hands', text: 'Their tiffin-sharing policy is...', example: '"Yours is ours, mine is already finished"' },

  // Time and place (8)
  { id: 'dp_free_period_spot', group: 'Time and place', area: 'feet', text: 'You can find them during free period at...', example: 'leaning on the corridor railing watching juniors' },
  { id: 'dp_arrive_exact', group: 'Time and place', area: 'shoes', text: 'They arrive at school exactly at...', example: '0.4 seconds before the main gate locks' },
  { id: 'dp_vanish_at', group: 'Time and place', area: 'feet', text: 'They vanish immediately at...', example: 'the moment a group project needs printing' },
  { id: 'dp_fav_corner', group: 'Time and place', area: 'feet', text: 'Their favourite corner of the school is...', example: 'the staircase blind spot near the water cooler' },
  { id: 'dp_assembly_spot', group: 'Time and place', area: 'shoulders', text: 'During morning assembly they are...', example: 'ducking behind the tallest person in the row' },
  { id: 'dp_pt_excuse_spot', group: 'Time and place', area: 'shoes', text: 'During PT period their feet take them to...', example: 'the medical room or shady steps behind the lab' },
  { id: 'dp_last_bell', group: 'Time and place', area: 'shoes', text: 'At the last bell their feet move at...', example: 'Mach 2 before the teacher finishes the sentence' },
  { id: 'dp_bench_territory', group: 'Time and place', area: 'shoulders', text: 'Their bench territory is marked by...', example: 'an elbow permanently claiming 70% of the desk' },

  // Wildcards (10)
  { id: 'dp_most_used_sentence', group: 'Wildcards', area: 'mouth', text: 'Their most-used sentence in class is...', example: '"Ma\'am may I go wash my face?"' },
  { id: 'dp_biggest_fear', group: 'Wildcards', area: 'brain', text: 'Their biggest school fear is...', example: '"Roll number wise viva starting now"' },
  { id: 'dp_secret_talent', group: 'Wildcards', area: 'hands', text: 'Their secret classroom talent is...', example: 'flipping a scale 360 degrees without dropping it' },
  { id: 'dp_homework_answer', group: 'Wildcards', area: 'mouth', text: 'Their answer to "Did you do the homework?" is...', example: '"Ma\'am I did it in my rough copy at home"' },
  { id: 'dp_always_borrows', group: 'Wildcards', area: 'hands', text: 'The thing they always borrow is...', example: 'black pen, whitener, and 10 rupees for canteen' },
  { id: 'dp_never_returns', group: 'Wildcards', area: 'pocket', text: 'The thing they never return is...', example: 'that one really smooth gel pen from September' },
  { id: 'dp_viva_aura', group: 'Wildcards', area: 'head', text: 'Their aura when the external examiner walks in...', example: 'confident smile concealing zero preparation' },
  { id: 'dp_whisper_mode', group: 'Wildcards', area: 'ears', text: 'Their whisper volume is actually...', example: 'audible from the principal\'s corridor' },
  { id: 'dp_exam_superpower', group: 'Wildcards', area: 'brain', text: 'Their exam-hall superpower is...', example: 'converting 1 known line into a 5-mark essay' },
  { id: 'dp_goodbye_aura', group: 'Wildcards', area: 'head', text: 'Behind all the chaos, their real vibe is...', example: 'the friend who makes an ordinary Tuesday iconic' },
] as const;
