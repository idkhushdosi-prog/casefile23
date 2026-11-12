export interface AwardCategory {
  key: string;
  title: string;
  shortTitle: string;
  emoji: string;
  promptLine: string;
}

export const AWARDS: readonly AwardCategory[] = [
  {
    key: 'late_own_wedding',
    title: 'Most likely to be late to their own wedding',
    shortTitle: 'Late to Own Wedding',
    emoji: '⏰',
    promptLine: 'The baraat is waiting, the pandit is checking his watch. Who is still "just leaving home"?',
  },
  {
    key: 'business_fail_loudly',
    title: 'Most likely to start a business and fail loudly',
    shortTitle: 'Loud Startup Flameout',
    emoji: '📉',
    promptLine: 'Will print hoodies, launch an app, buy a neon sign, and owe everyone ₹50 by Friday.',
  },
  {
    key: 'become_teacher',
    title: 'Most likely to become a teacher',
    shortTitle: 'Future Teacher',
    emoji: '📏',
    promptLine: 'Already says "Pin-drop silence" unironically and enjoys checking other people\'s work.',
  },
  {
    key: 'pretending_notes',
    title: 'Best at pretending to take notes',
    shortTitle: 'Fake Note-Taker',
    emoji: '🖊️',
    promptLine: 'Furious pen movement, intense brow furrow — turns page, it\'s an intricate doodle of a frog.',
  },
  {
    key: 'final_boss_group_projects',
    title: 'Final boss of group projects',
    shortTitle: 'Group Project Boss',
    emoji: '🗂️',
    promptLine: 'Either carries the entire PPT at 2 AM or demands aesthetic font changes 4 minutes before submission.',
  },
  {
    key: 'funniest_not_trying',
    title: 'Funniest when not trying',
    shortTitle: 'Unintentional Comedy',
    emoji: '💀',
    promptLine: 'Says something completely deadpan or trips over air and breaks the whole row.',
  },
  {
    key: 'just_one_more_doubt',
    title: 'Most likely to say "just one more doubt" and ask five',
    shortTitle: 'Just One More Doubt',
    emoji: '🙋',
    promptLine: 'The bell rang 4 minutes ago. Everyone is packing bags. This person raises their hand.',
  },
  {
    key: 'teachers_favourite_denied',
    title: "Teacher's favourite, officially denied",
    shortTitle: 'Undercover Favourite',
    emoji: '🍎',
    promptLine: 'Swears teachers hate them, yet somehow always gets chosen to carry the register.',
  },
  {
    key: 'walking_wikipedia',
    title: 'Walking Wikipedia of useless facts',
    shortTitle: 'Useless Facts Wiki',
    emoji: '🧠',
    promptLine: 'Will explain how pigeon navigation works right before a Physics pre-board.',
  },
  {
    key: 'survive_zombie_apocalypse',
    title: 'Most likely to survive a zombie apocalypse',
    shortTitle: 'Zombie Survivor',
    emoji: '🪓',
    promptLine: 'Calm under pressure, hoards snacks, knows where every exit door in school is.',
  },
  {
    key: 'give_up_zombie_apocalypse',
    title: 'First to give up in a zombie apocalypse',
    shortTitle: 'First Zombie Snack',
    emoji: '🫠',
    promptLine: '"Running? In this humidity? Nah, bite me."',
  },
  {
    key: 'call_3am_before_exam',
    title: 'Who would you call at 3 AM before the exam?',
    shortTitle: '3 AM Exam Lifeline',
    emoji: '📞',
    promptLine: 'Guaranteed awake, weirdly calm, and willing to voice-note Chapter 7 in 90 seconds.',
  },
  {
    key: 'hiding_sports_period',
    title: 'Most likely to be hiding during the sports period',
    shortTitle: 'PT Period Fugitive',
    emoji: '🫥',
    promptLine: 'Suddenly develops a sprained ankle or urgent library research whenever PT begins.',
  },
  {
    key: 'talk_way_out_anything',
    title: 'Who can talk their way out of anything?',
    shortTitle: 'Smooth Talker',
    emoji: '🎙️',
    promptLine: 'Caught red-handed without homework and leaves the staffroom with an apology from the teacher.',
  },
] as const;
