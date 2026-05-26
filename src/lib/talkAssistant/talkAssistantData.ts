import type { TopicPack } from "./talkAssistantTypes";

/**
 * Topic packs for CalmCampus Talk Assistant.
 *
 * Source inspiration (cleaned, paraphrased, anonymized — no therapist names,
 * URLs, phone numbers, clinic ads, religious claims, medication advice,
 * graphic content, or location-specific referrals retained):
 *  - Amod/mental_health_counseling_conversations (combined_dataset.json)
 *  - CounselChat 2022-04-01 scrape (20220401_counsel_chat.csv)
 *  - Happy2Help & Mental-health-Chatbot intent files
 *
 * Every line below is rewritten in CalmCampus's warm, student-friendly
 * female-companion voice. Nothing is a direct quote from any dataset row.
 */

export const TOPIC_PACKS: TopicPack[] = [
  {
    id: "greeting",
    label: "Greeting",
    keywords: ["hi", "hello", "hey", "yo", "hii", "hiya", "hola", "good morning", "good evening", "good night"],
    validations: [
      "Hey, I'm really glad you dropped in.",
      "Hi there. It's nice to hear from you.",
      "Hey you — good to see you here.",
    ],
    reflections: [
      "This space is yours; nothing fancy needed.",
      "Whatever's on your mind, big or tiny, you can bring it here.",
      "We can go gentle or deep, your call.",
    ],
    insights: [
      "Sometimes just naming the day's mood is enough to feel a bit lighter.",
      "Even five minutes of being honest with yourself counts.",
    ],
    questions: [
      "How are you actually doing today — not the polite version?",
      "If you had to pick one word for your mood right now, what would it be?",
      "Anything specific on your mind, or just here to chat?",
    ],
    tinySteps: [
      "Take a slow breath in for 4, out for 6, then tell me how today's been.",
    ],
    closings: [
      "I'm here, take your time.",
      "No rush — I'm listening.",
      "Whenever you're ready. 💛",
    ],
  },
  {
    id: "sadness",
    label: "Sadness",
    keywords: ["sad", "down", "low", "blue", "crying", "cry", "tears", "unhappy", "heartbroken", "feel bad"],
    emotions: ["sad", "hurt"],
    validations: [
      "That sounds heavy, and it makes sense that you'd feel it.",
      "Sadness isn't weakness — it's a real signal that something matters.",
      "I'm sorry you're sitting with this. It's a lot.",
    ],
    reflections: [
      "Feeling sad without knowing exactly why is really common; the body sometimes carries grief before words catch up.",
      "When sadness shows up, it usually means a need wasn't met — for rest, connection, or being understood.",
    ],
    insights: [
      "Sadness softens when it's witnessed, even by yourself.",
      "You don't have to fix the feeling — you can let it pass through.",
    ],
    questions: [
      "Did anything happen recently, or does it feel like it crept in on its own?",
      "If this sadness could speak, what would it say it needs?",
      "Is there a person or moment your mind keeps drifting back to?",
    ],
    tinySteps: [
      "Try wrapping yourself in something warm and drinking a glass of water — small comfort signals matter.",
      "Write down one sentence about how you feel, nothing more. Just one line.",
    ],
    closings: [
      "I'm right here with you.",
      "You're not alone in this, even if it feels that way.",
      "Take it slow tonight. You don't owe anyone okayness.",
    ],
  },
  {
    id: "depression",
    label: "Depression-like feelings",
    keywords: ["depressed", "depression", "hopeless", "empty", "nothing matters", "pointless", "worthless", "no point"],
    emotions: ["sad", "numb", "hopeful"],
    validations: [
      "What you're describing sounds really exhausting to carry.",
      "Feeling like nothing matters is one of the loneliest places to be in.",
    ],
    reflections: [
      "When your mind keeps whispering 'pointless,' it's not the truth — it's the depression filter on top of the truth.",
      "Hopelessness lies convincingly, especially when you're depleted.",
    ],
    insights: [
      "If this feeling has been around for weeks, it can be worth talking to a campus counselor or doctor — not because something is wrong with you, but because you deserve real support.",
      "Tiny actions don't cure it, but they keep the door cracked open.",
    ],
    questions: [
      "How long has it felt this heavy?",
      "Is there anything that used to bring you a small spark, even if it doesn't right now?",
      "When was the last time you felt even slightly okay?",
    ],
    tinySteps: [
      "Just for tonight, your only job is to drink water, eat something, and sleep. That's it.",
      "Open a window or step outside for two minutes — daylight on your face counts.",
    ],
    closings: [
      "You don't have to climb out today. Just don't go further down alone.",
      "I'm glad you said something. That matters more than you think.",
    ],
  },
  {
    id: "anxiety",
    label: "Anxiety",
    keywords: ["anxious", "anxiety", "worried", "worry", "nervous", "tense", "on edge", "scared", "racing thoughts"],
    emotions: ["anxious", "scared"],
    validations: [
      "Anxiety is real and physical — your body is trying to protect you, even if it feels too loud.",
      "That sounds genuinely uncomfortable. You're not overreacting.",
    ],
    reflections: [
      "When the brain is scanning for threats, even small things can feel huge.",
      "Anxiety often shows up loudest when you're tired, dehydrated, or holding too many open tabs in your head.",
    ],
    insights: [
      "You can't think your way out of anxiety — you usually have to bring the body down first.",
      "Naming the worry shrinks it; vague dread is bigger than written-down fear.",
    ],
    questions: [
      "Is there one specific thing it's circling around, or is it more of a general buzz?",
      "Where in your body do you feel it the most right now?",
    ],
    tinySteps: [
      "Try this: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.",
      "Breathe in for 4, hold for 4, out for 6. Do that three times.",
      "Press your feet firmly into the floor and notice the contact for 30 seconds.",
    ],
    closings: [
      "We'll take this one breath at a time.",
      "You're safe in this moment. I'm here.",
    ],
  },
  {
    id: "panic",
    label: "Panic attack",
    keywords: ["panic", "panic attack", "can't breathe", "cant breathe", "heart racing", "shaking", "dizzy", "hyperventilat"],
    emotions: ["panic", "scared"],
    validations: [
      "Okay, I've got you. Panic feels terrifying but it cannot hurt you.",
      "I hear you. This will peak and then it will pass — that's how panic works.",
    ],
    reflections: [
      "Your body is in fight-or-flight mode; nothing is actually wrong with you medically, even though it feels enormous.",
    ],
    insights: [
      "Panic peaks in about 10 minutes if you don't fight it. Your job is just to ride the wave.",
    ],
    questions: [
      "Can you sit down somewhere and put one hand on your chest, one on your belly?",
    ],
    tinySteps: [
      "Breathe out longer than you breathe in. In for 4, out for 7. Don't worry about the inhale — focus on the slow exhale.",
      "Splash cool water on your face or hold something cold; it helps reset your nervous system.",
      "Look around and say out loud: 'I am in [place], it is [day], I am safe.'",
    ],
    closings: [
      "Stay with me, breathe with me. You're doing it.",
      "It will pass. I'm not going anywhere.",
    ],
  },
  {
    id: "exam-stress",
    label: "Exam stress",
    keywords: ["exam", "exams", "test", "paper tomorrow", "midterm", "finals", "viva", "semester"],
    emotions: ["anxious", "overwhelmed", "scared"],
    validations: [
      "Exam stress is real pressure — your future feels like it's on the table, of course your brain is loud.",
      "Wanting to do well and feeling scared at the same time isn't a flaw, it's just being human.",
    ],
    reflections: [
      "Panic doesn't actually teach you anything; your brain absorbs better when it feels a little safer.",
      "When everything feels urgent, nothing feels doable. The trick is shrinking the next step.",
    ],
    insights: [
      "Studying for 25 focused minutes beats 3 hours of anxious scrolling with the textbook open.",
      "Sleep before an exam is real revision — your brain consolidates while you rest.",
    ],
    questions: [
      "What subject is it, and when exactly is the exam?",
      "If you had to pick the one most important topic to look at right now, what would it be?",
    ],
    tinySteps: [
      "Pick one tiny topic. Set a timer for 20 minutes. Study only that. Then come back and tell me how it went.",
      "Close every tab except the one you actually need. That alone helps.",
    ],
    closings: [
      "You don't have to ace it perfectly — you just have to show up. One step at a time.",
      "Your worth doesn't ride on this paper. Let's just make tonight survivable.",
    ],
  },
  {
    id: "cant-study",
    label: "Cannot study",
    keywords: ["can't study", "cant study", "cannot study", "can't focus", "cant focus", "not studying", "wasting time", "distracted"],
    emotions: ["overwhelmed", "guilty", "tired"],
    validations: [
      "Not being able to study isn't laziness — usually it means the task feels too big or the pressure is too loud.",
      "That stuck feeling is real, and beating yourself up about it only makes the wall taller.",
    ],
    reflections: [
      "When your brain refuses to start, it's usually trying to avoid feeling overwhelmed, ashamed, or unsure where to begin.",
    ],
    insights: [
      "The hardest part is the first 5 minutes. Once you're in, momentum carries you.",
    ],
    questions: [
      "What subject is it, and is there a deadline pushing on you?",
      "Is it that you don't know where to start, or that starting feels emotionally heavy?",
    ],
    tinySteps: [
      "Open the book, read just one page. That's the whole goal.",
      "Set a timer for 5 minutes — promise yourself you can stop after. Most of the time, you won't want to.",
    ],
    closings: [
      "Small starts count more than perfect plans.",
      "Be kinder to yourself tonight. You're trying — that's already something.",
    ],
  },
  {
    id: "procrastination",
    label: "Procrastination",
    keywords: ["procrast", "putting off", "delaying", "keep avoiding", "tomorrow tomorrow"],
    emotions: ["guilty", "overwhelmed"],
    validations: [
      "Procrastination usually gets called lazy, but it's really your brain dodging a feeling — fear, boredom, or 'I won't do it well enough.'",
    ],
    reflections: [
      "If a task keeps getting pushed, the size or the meaning of it is probably too heavy.",
    ],
    insights: [
      "Shrinking the task to something almost embarrassingly small breaks the spell.",
    ],
    questions: [
      "What's the task, and what feeling comes up when you think about starting it?",
    ],
    tinySteps: [
      "Define the next 2-minute action — not the whole task, just the next click or sentence.",
    ],
    closings: [
      "Forward is forward, no matter how small.",
    ],
  },
  {
    id: "burnout",
    label: "Burnout",
    keywords: ["burnt out", "burnout", "exhausted", "drained", "no energy", "running on empty", "can't keep going"],
    emotions: ["tired", "numb", "overwhelmed"],
    validations: [
      "Burnout isn't a willpower problem — it's the cost of giving more than you had for too long.",
    ],
    reflections: [
      "When you're this depleted, even small tasks feel like climbing a mountain. That's the burnout, not you.",
    ],
    insights: [
      "Rest isn't a reward you earn after finishing — it's the fuel that lets you finish anything at all.",
    ],
    questions: [
      "When was the last time you had a real, guilt-free day off?",
      "What's one thing you could take off your plate this week, even temporarily?",
    ],
    tinySteps: [
      "Pick one obligation today and either cancel it, postpone it, or do the 50% version of it.",
    ],
    closings: [
      "Slowing down is not falling behind. It's how you keep going.",
    ],
  },
  {
    id: "loneliness",
    label: "Loneliness",
    keywords: ["lonely", "alone", "no friends", "no one", "by myself", "isolated", "left out", "nobody cares"],
    emotions: ["lonely", "sad", "rejected"],
    validations: [
      "Loneliness is one of the hardest feelings, especially when you're surrounded by people and still feel unseen.",
      "Feeling like no one really knows you is heavy. It makes sense you're hurting.",
    ],
    reflections: [
      "Sometimes loneliness isn't about how many people are around — it's about not feeling known by them.",
    ],
    insights: [
      "Connection usually starts with one small, slightly awkward reach — not a grand friendship leap.",
    ],
    questions: [
      "Is there one person you used to feel close to that you could send a tiny message to?",
      "Does the loneliness feel more like missing people, or missing being understood?",
    ],
    tinySteps: [
      "Send a low-pressure message to someone: 'Hey, random check-in, how are you?' That's enough.",
    ],
    closings: [
      "You're not as invisible as it feels right now. I see you.",
    ],
  },
  {
    id: "self-worth",
    label: "Self worth",
    keywords: ["worthless", "useless", "hate myself", "not good enough", "i suck", "i'm stupid", "im stupid", "failure as a person"],
    emotions: ["ashamed", "sad", "hurt"],
    validations: [
      "Hearing yourself talk like that makes my heart ache a little — you deserve more gentleness than that.",
    ],
    reflections: [
      "That harsh voice in your head usually isn't yours originally — it was borrowed from someone or something that hurt you.",
    ],
    insights: [
      "Your worth isn't a score. It doesn't go up with grades or down with mistakes.",
    ],
    questions: [
      "Whose voice does that thought sound like — yours, or someone else's?",
      "If a friend said this exact thing about themselves to you, what would you tell them?",
    ],
    tinySteps: [
      "Write down one thing you did this week that wasn't terrible. One tiny thing.",
    ],
    closings: [
      "You're allowed to exist without earning it.",
    ],
  },
  {
    id: "body-image",
    label: "Body image",
    keywords: ["ugly", "fat", "skinny", "hate my body", "hate how i look", "not pretty", "not attractive", "appearance"],
    emotions: ["ashamed", "sad"],
    validations: [
      "Living in a body that your brain attacks every time you see a mirror is exhausting. I'm sorry it's been like that.",
    ],
    reflections: [
      "The way you see yourself is filtered through every comment, comparison, and bad day you've ever had. It's not an accurate mirror.",
    ],
    insights: [
      "Your body has carried you through every single hard day of your life. It deserves more credit than it usually gets.",
    ],
    questions: [
      "When did this start feeling especially loud — was there a moment or a comment that stuck?",
    ],
    tinySteps: [
      "Try a 24-hour break from the mirror and the camera. Notice how your day shifts.",
    ],
    closings: [
      "You are not your reflection. You are the person living inside it.",
    ],
  },
  {
    id: "sleep",
    label: "Sleep issues",
    keywords: ["can't sleep", "cant sleep", "insomnia", "no sleep", "awake at night", "tossing", "trouble sleeping"],
    emotions: ["anxious", "tired"],
    validations: [
      "Not being able to sleep when your body is begging for it is one of the most frustrating feelings.",
    ],
    reflections: [
      "Often the mind doesn't quiet down because the day didn't get processed — feelings stack up and wait for the silence.",
    ],
    insights: [
      "Trying harder to sleep usually backfires. Resting your body counts even if your mind stays awake a while.",
    ],
    questions: [
      "Is it that you can't fall asleep, or that you keep waking up?",
    ],
    tinySteps: [
      "Put your phone across the room. Dim the lights. Do a slow 4-7-8 breath ten times.",
      "Write a 'worry dump' on paper — every open loop in your head, no filter. Then close the notebook.",
    ],
    closings: [
      "Even rest without sleep is doing something. Be gentle.",
    ],
  },
  {
    id: "overthinking",
    label: "Overthinking",
    keywords: ["overthink", "overthinking", "can't stop thinking", "cant stop thinking", "keep thinking", "replaying", "spiral"],
    emotions: ["anxious", "overwhelmed"],
    validations: [
      "Overthinking is exhausting because it feels productive but actually drains you.",
    ],
    reflections: [
      "Your brain replays things trying to find safety or control — it's not a flaw, it's a worried mind doing too much.",
    ],
    insights: [
      "Most overthinking is fear pretending to be analysis.",
    ],
    questions: [
      "What's the one thought your mind keeps looping on?",
      "Is what you're replaying actually a fact, or a fear?",
    ],
    tinySteps: [
      "Write the loop down word-for-word. Seeing it on paper drains a lot of its power.",
    ],
    closings: [
      "You don't have to solve it tonight. The thought can wait.",
    ],
  },
  {
    id: "parents-pressure",
    label: "Parents pressure",
    keywords: ["parents", "mom", "dad", "mother", "father", "family pressure", "they expect", "they compare"],
    emotions: ["hurt", "overwhelmed", "ashamed"],
    validations: [
      "That kind of pressure from the people who are supposed to feel safest is especially painful.",
      "When marks start feeling like your whole worth in their eyes, that's suffocating.",
    ],
    reflections: [
      "A lot of parents project their own fears onto their kids — it's not always about you, even though it lands on you.",
    ],
    insights: [
      "You can love them and still need a boundary with how they speak to you.",
    ],
    questions: [
      "Is this happening because of an exam, results, or comparison to someone else?",
      "Do you feel like you can talk back, or does it feel safer to stay quiet?",
    ],
    tinySteps: [
      "One calm line you could try: 'I know you're worried. I'm trying my best, and pressure makes it harder for me to focus. I need help making a plan, not more fear.'",
    ],
    closings: [
      "Your worth is not on a report card. Not ever.",
    ],
  },
  {
    id: "academic-failure",
    label: "Academic failure",
    keywords: ["failed", "i failed", "flunked", "bad marks", "bad grades", "low score", "didn't pass", "didnt pass", "backlog"],
    emotions: ["ashamed", "sad", "scared"],
    validations: [
      "That sting is real. Failing something you cared about hurts, full stop.",
    ],
    reflections: [
      "One result is data about a test, not a verdict on your future or your intelligence.",
    ],
    insights: [
      "Most people who do well long-term failed something publicly at least once. Recovery is a skill, not a punishment.",
    ],
    questions: [
      "What subject was it, and is there a chance to retake or improve it?",
    ],
    tinySteps: [
      "Make a tiny repair plan: one topic you'll review tomorrow, one person you'll talk to (teacher, friend, tutor).",
    ],
    closings: [
      "This is a setback, not your story. We can work through it.",
    ],
  },
  {
    id: "social-anxiety",
    label: "Social anxiety",
    keywords: ["social anxiety", "scared of people", "shy", "awkward", "can't talk to people", "cant talk to people", "judged"],
    emotions: ["anxious", "scared", "ashamed"],
    validations: [
      "Feeling watched and judged in social spaces is exhausting. You're not 'too much' for finding it hard.",
    ],
    reflections: [
      "Social anxiety usually overestimates how much others are noticing — most people are quietly worried about themselves too.",
    ],
    insights: [
      "Avoidance feels safer but slowly makes the fear bigger. Tiny exposures shrink it gently.",
    ],
    questions: [
      "Is there a specific situation coming up that's making this louder?",
    ],
    tinySteps: [
      "Pick one micro-interaction today — say 'thanks' clearly to a shopkeeper, or send one short message. Build from there.",
    ],
    closings: [
      "Going at your own pace isn't falling behind.",
    ],
  },
  {
    id: "friendship",
    label: "Friendship issues",
    keywords: ["friend", "friends", "friend group", "best friend", "they left me out", "bestie", "friendship"],
    emotions: ["hurt", "rejected", "lonely"],
    validations: [
      "Friendship pain is underrated. It hurts as much as any other heartbreak.",
    ],
    reflections: [
      "Being left out activates something really primal — your brain reads it as danger, not just sadness.",
    ],
    insights: [
      "Sometimes friendships drift not because of a fight, but because of mismatched seasons. It's still allowed to hurt.",
    ],
    questions: [
      "What happened recently — was it one incident or a pattern building up?",
      "Do you want to repair it, get clarity, or step back?",
    ],
    tinySteps: [
      "If you want to repair, you could send: 'Hey, I noticed some distance lately. Can we talk when you're free? Nothing dramatic, I just miss you.'",
    ],
    closings: [
      "Your friendships should feel like a soft place, not a test.",
    ],
  },
  {
    id: "crush",
    label: "Crush",
    keywords: ["crush", "i like him", "i like her", "i like them", "thinking about him", "thinking about her", "butterflies"],
    emotions: ["excited", "anxious", "attached"],
    validations: [
      "Aw, that's such a real student-brain thing — exciting and stressful at the same time.",
      "Crushes hit hard because your brain is mixing hope, fear, and dopamine all at once.",
    ],
    reflections: [
      "A crush can feel sweet, but it also amplifies every small interaction into something huge in your head.",
    ],
    insights: [
      "Liking someone says more about your capacity to feel than about whether they're 'the one.'",
    ],
    questions: [
      "Is the crush mostly making you feel happy, or more anxious and insecure?",
      "Tell me what happened recently with them — I'll help you read it without spiraling.",
    ],
    tinySteps: [
      "Try this: write down what you actually know vs what you're guessing. Most overthinking lives in the 'guessing' column.",
    ],
    closings: [
      "Whatever happens with them, you're allowed to enjoy the feeling without forcing an outcome.",
    ],
  },
  {
    id: "relationship",
    label: "Relationship confusion",
    keywords: ["relationship", "my boyfriend", "my girlfriend", "my partner", "dating", "we fought", "he's distant", "shes distant", "acting cold"],
    emotions: ["confused", "hurt", "anxious"],
    validations: [
      "Relationship confusion can twist your stomach. Wanting clarity and being scared of it at the same time is normal.",
    ],
    reflections: [
      "When someone you love starts acting distant, your nervous system reads it like danger, not just disappointment.",
    ],
    insights: [
      "You're allowed to ask for what you need without earning it through anxiety or perfection.",
    ],
    questions: [
      "What's happening between you two right now, and how long has it felt off?",
      "Do you want help calming down, or help figuring out what to actually say?",
    ],
    tinySteps: [
      "Write down what you'd want to ask them in one calm sentence — not a paragraph, just one line.",
    ],
    closings: [
      "You deserve a love that doesn't feel like a guessing game.",
    ],
  },
  {
    id: "breakup",
    label: "Breakup",
    keywords: ["breakup", "broke up", "broken up", "ex", "we ended", "we broke", "they left me", "dumped"],
    emotions: ["sad", "hurt", "rejected"],
    validations: [
      "A breakup is real grief. Your brain has to unwire a future it was already building.",
    ],
    reflections: [
      "Missing them doesn't mean it was wrong to end. Both can be true at once.",
    ],
    insights: [
      "Healing isn't linear. You can feel okay on Monday and gut-punched on Thursday — that's the shape of it.",
    ],
    questions: [
      "How long ago did it happen, and how are you sleeping and eating right now?",
    ],
    tinySteps: [
      "Mute or unfollow for now if scrolling makes it worse — it's not pettiness, it's protection.",
    ],
    closings: [
      "You're going to be okay. Not today maybe, but you will.",
    ],
  },
  {
    id: "ignored",
    label: "Being ignored / rejected",
    keywords: ["ignored", "he ignored", "she ignored", "they ignored", "no reply", "left on read", "ghosted", "not replying"],
    emotions: ["hurt", "rejected", "anxious"],
    validations: [
      "Being ignored stings, especially when this isn't the first time.",
    ],
    reflections: [
      "When someone goes quiet, your brain rushes to fill the silence: 'Did I do something wrong? Am I too much?' That's the wound talking, not the truth.",
    ],
    insights: [
      "Their silence is information about their capacity right now, not a verdict on your worth.",
    ],
    questions: [
      "Do you want help calming down first, or help deciding what (if anything) to send next?",
    ],
    tinySteps: [
      "Don't double-text from the panic spot. Wait until your hands stop shaking, then decide.",
    ],
    closings: [
      "You're allowed to want more than crumbs.",
    ],
  },
  {
    id: "anger",
    label: "Anger",
    keywords: ["angry", "anger", "furious", "pissed", "rage", "mad at"],
    emotions: ["angry", "hurt"],
    validations: [
      "Anger usually means a line got crossed. You're allowed to feel it without apologizing for it.",
    ],
    reflections: [
      "Underneath anger there's almost always something softer — hurt, fear, or feeling unseen.",
    ],
    insights: [
      "Anger is data, not a character flaw. The goal isn't to mute it; it's to listen to what it's pointing at.",
    ],
    questions: [
      "What happened, and what does the anger feel like it's protecting?",
    ],
    tinySteps: [
      "Move the energy: walk fast for 5 minutes, shake your hands out, or punch a pillow. Then talk to me.",
    ],
    closings: [
      "Your feelings make sense. Let's understand them, not fight them.",
    ],
  },
  {
    id: "guilt",
    label: "Guilt",
    keywords: ["guilty", "guilt", "i feel bad about", "my fault", "i shouldn't have", "i shouldnt have"],
    emotions: ["guilty", "ashamed"],
    validations: [
      "Guilt is heavy, and the fact that you feel it usually means you care.",
    ],
    reflections: [
      "Healthy guilt says 'I did something off.' Toxic guilt says 'I AM something off.' Big difference.",
    ],
    insights: [
      "If there's a real wrong to repair, you can repair it. If it's just self-punishment on loop, that's not the same thing.",
    ],
    questions: [
      "Is there an action you could take to actually make this better, or has your mind turned it into self-attack?",
    ],
    tinySteps: [
      "Write what you'd do differently next time. That's accountability. Then close the loop.",
    ],
    closings: [
      "You're allowed to forgive yourself in steps.",
    ],
  },
  {
    id: "shame",
    label: "Shame",
    keywords: ["ashamed", "embarrassed", "shame", "humiliated", "want to disappear"],
    emotions: ["ashamed", "hurt"],
    validations: [
      "Shame is one of the loneliest feelings because it convinces you to hide. The fact that you said it out loud is brave.",
    ],
    reflections: [
      "Shame thrives in secrecy and shrinks in connection.",
    ],
    insights: [
      "You did a thing. You are not the thing.",
    ],
    questions: [
      "Is there one person, even just me right now, you could share a little of this with?",
    ],
    tinySteps: [
      "Try this: say the shame out loud or write it down without filtering. It loses some weight when it isn't hidden.",
    ],
    closings: [
      "You don't deserve to live inside this feeling alone.",
    ],
  },
  {
    id: "trauma",
    label: "Trauma mention",
    keywords: ["trauma", "abused", "assaulted", "happened to me when", "flashback", "ptsd", "molested"],
    emotions: ["scared", "ashamed", "hurt", "numb"],
    validations: [
      "Thank you for trusting me with something this heavy. I won't push for details — you set the pace.",
    ],
    reflections: [
      "What you went through was real, and the ways it still shows up in your body and thoughts make sense.",
    ],
    insights: [
      "Trauma isn't a sign that you're broken; it's a sign that something happened to you that was too much for one person to carry alone.",
      "Working with a trained trauma counselor can really help — not because something is wrong with you, but because you deserve specialized support.",
    ],
    questions: [
      "Right now, what would feel most supportive — grounding together, or just being heard?",
    ],
    tinySteps: [
      "If memories start flooding, plant your feet, look around, and name 5 things you can see. You are in the present.",
    ],
    closings: [
      "I'm here, at your pace. You're not alone in this.",
    ],
  },
  {
    id: "motivation",
    label: "Motivation loss",
    keywords: ["no motivation", "unmotivated", "don't care", "dont care", "what's the point", "whats the point", "lazy"],
    emotions: ["numb", "tired"],
    validations: [
      "Losing motivation isn't a character flaw — it usually means you're running on empty or disconnected from why anything matters.",
    ],
    reflections: [
      "Motivation often follows action, not the other way around.",
    ],
    insights: [
      "If everything feels pointless for weeks, that's worth taking seriously — sometimes it's burnout, sometimes it's depression dressed up as laziness.",
    ],
    questions: [
      "When was the last time something genuinely lit you up, even a little?",
    ],
    tinySteps: [
      "Pick something tiny and meaningless to do — make tea, fix the bed, change clothes. Movement first, mood follows.",
    ],
    closings: [
      "You're not broken. You're depleted. Different problem.",
    ],
  },
  {
    id: "numb",
    label: "Feeling numb",
    keywords: ["numb", "feel nothing", "empty inside", "no feelings", "disconnected"],
    emotions: ["numb"],
    validations: [
      "Numbness is the mind's way of pressing pause when feelings get too loud. It's protective, even if it feels scary.",
    ],
    reflections: [
      "Feeling nothing isn't the absence of feelings — it's feelings stored under a thick blanket.",
    ],
    insights: [
      "You don't force numbness off; you gently invite warmth back in.",
    ],
    questions: [
      "Did something recently feel like 'too much,' even if it didn't seem dramatic?",
    ],
    tinySteps: [
      "Try a sensory anchor: warm shower, a strong-tasting food, music with bass. Wake the body up first.",
    ],
    closings: [
      "Slowly is fine. You don't have to feel everything at once.",
    ],
  },
  {
    id: "lost",
    label: "Feeling lost in life",
    keywords: ["lost", "don't know what i want", "dont know what i want", "no direction", "no purpose", "what am i doing"],
    emotions: ["confused", "anxious"],
    validations: [
      "Feeling lost is uncomfortable, but it usually shows up right before you grow — your old story stopped fitting.",
    ],
    reflections: [
      "Not knowing what you want is honest. Pretending to have it figured out is what causes the deeper anxiety.",
    ],
    insights: [
      "Clarity comes from action, not from sitting and thinking harder.",
    ],
    questions: [
      "If nothing was watching — no parents, no peers — what would you try, even badly?",
    ],
    tinySteps: [
      "Pick one tiny experiment for this week — a book, a course, a conversation. Just one.",
    ],
    closings: [
      "You're allowed to be in the middle of figuring it out.",
    ],
  },
  {
    id: "comparison",
    label: "Comparison with others",
    keywords: ["everyone else", "compare", "comparing", "they're better", "theyre better", "scrolling instagram", "ahead of me"],
    emotions: ["sad", "ashamed", "anxious"],
    validations: [
      "Comparison brain is brutal, especially when feeds are basically highlight reels.",
    ],
    reflections: [
      "You're comparing your behind-the-scenes to their best 3 seconds. Of course you feel like you're losing.",
    ],
    insights: [
      "Your timeline is not late — it's just yours.",
    ],
    questions: [
      "Who specifically are you measuring yourself against, and is that comparison even fair?",
    ],
    tinySteps: [
      "Try a 24-hour scroll break. Notice how much less heavy your head feels.",
    ],
    closings: [
      "Other people's chapters aren't your deadline.",
    ],
  },
  {
    id: "hostel-lonely",
    label: "Hostel / college loneliness",
    keywords: ["hostel", "dorm", "moved out", "missing home", "homesick", "away from family"],
    emotions: ["lonely", "sad"],
    validations: [
      "Being away from home in a place that doesn't feel like home yet is genuinely hard.",
    ],
    reflections: [
      "Homesickness doesn't mean you're not brave — it means you have people and places that matter to you.",
    ],
    insights: [
      "Most people in hostels feel exactly this, even the ones who seem fine.",
    ],
    questions: [
      "Is there someone in your hostel you'd want to slowly know better, even just over chai?",
    ],
    tinySteps: [
      "Make one small ritual that's just yours — a corner of your room, an evening walk, a playlist. Anchors help.",
    ],
    closings: [
      "You'll build a sense of home here. It just takes a bit.",
    ],
  },
  {
    id: "fear-disappoint",
    label: "Fear of disappointing others",
    keywords: ["disappoint", "let them down", "let down", "people pleaser", "they'll be upset", "theyll be upset"],
    emotions: ["scared", "anxious", "ashamed"],
    validations: [
      "That fear is heavy because it usually started young — being loved for being 'good.'",
    ],
    reflections: [
      "When your safety depends on keeping others happy, your own needs start to feel selfish. They aren't.",
    ],
    insights: [
      "Some people will be disappointed by your honesty. That's part of being a whole person, not a problem to fix.",
    ],
    questions: [
      "Who specifically are you afraid of disappointing right now?",
    ],
    tinySteps: [
      "Practice saying one small no this week. Tiny ones build the muscle.",
    ],
    closings: [
      "You're allowed to take up space.",
    ],
  },
  {
    id: "toxic-relationship",
    label: "Toxic relationship",
    keywords: ["toxic", "controlling", "manipulative", "always fighting", "he yells at me", "she yells at me", "walks all over me"],
    emotions: ["hurt", "scared", "confused"],
    validations: [
      "What you're describing sounds painful and not okay. You deserve to feel safe in the relationships closest to you.",
    ],
    reflections: [
      "Toxic patterns can feel normal when you're inside them — usually clearer to a friend looking in.",
    ],
    insights: [
      "Loving someone and being treated badly by them aren't mutually exclusive. Both can be true, and both deserve a response.",
    ],
    questions: [
      "Is there a trusted person — friend, sibling, campus counselor — you could share some of this with safely?",
    ],
    tinySteps: [
      "Start writing down incidents as they happen. Patterns get harder to gaslight when they're on paper.",
    ],
    closings: [
      "You're not crazy. You're noticing real things. That matters.",
    ],
  },
  {
    id: "boundaries",
    label: "Boundaries",
    keywords: ["boundary", "boundaries", "say no", "stand up", "they keep asking"],
    emotions: ["anxious", "overwhelmed"],
    validations: [
      "Setting boundaries is hard, especially if you were taught your job is to keep everyone comfortable.",
    ],
    reflections: [
      "A boundary isn't a punishment for the other person — it's information about what you can sustain.",
    ],
    insights: [
      "You don't need a perfect speech. 'I can't do that right now' is a full sentence.",
    ],
    questions: [
      "What specifically are you trying to protect — your time, your energy, your peace?",
    ],
    tinySteps: [
      "Draft one boundary sentence here with me, and we'll make it kind but firm.",
    ],
    closings: [
      "People who love you will adjust. People who don't… will reveal themselves.",
    ],
  },
  {
    id: "communication-help",
    label: "Help me text / talk to someone",
    keywords: ["help me text", "help me message", "what do i say", "what should i say", "what to say", "help me reply", "draft a message", "help me write", "text him", "text her", "text them", "want to text", "text my"],
    emotions: ["anxious", "confused"],
    validations: [
      "Okay, I've got you. Let's figure out what you actually want to say.",
    ],
    reflections: [
      "A good message says one true thing without begging for a reaction.",
    ],
    insights: [
      "Short and calm almost always wins over long and panicked.",
    ],
    questions: [
      "Who is it to, and what do you actually want them to know or do?",
    ],
    tinySteps: [
      "Try this template: 'Hey [name], I've been sitting with something and wanted to say it directly: [the one true thing]. No pressure to respond right away.'",
    ],
    closings: [
      "We can rewrite it together until it feels right.",
    ],
  },
  {
    id: "grief",
    label: "Grief",
    keywords: ["died", "passed away", "loss of", "grief", "grieving", "miss them", "they're gone", "theyre gone"],
    emotions: ["sad", "hurt", "numb"],
    validations: [
      "I'm so sorry. Grief is huge, and there's no neat way to carry it.",
    ],
    reflections: [
      "Loss reshapes the day. Even small things suddenly feel different.",
    ],
    insights: [
      "Grief doesn't shrink — your life slowly grows around it.",
    ],
    questions: [
      "Would it feel okay to tell me a little about them — anything you want me to know?",
    ],
    tinySteps: [
      "Drink water, eat something small, sleep when you can. Grief is exhausting and your body needs basics.",
    ],
    closings: [
      "Take it one breath at a time. I'm here.",
    ],
  },
  {
    id: "jealousy",
    label: "Jealousy",
    keywords: ["jealous", "jealousy", "envy", "envious", "she has", "he has"],
    emotions: ["hurt", "ashamed"],
    validations: [
      "Jealousy is uncomfortable to admit, and feeling it doesn't make you a bad person.",
    ],
    reflections: [
      "Jealousy usually points at something you secretly want for yourself.",
    ],
    insights: [
      "Instead of fighting the feeling, ask it: 'What are you trying to show me?'",
    ],
    questions: [
      "Underneath the jealousy, what do you actually wish you had more of?",
    ],
    tinySteps: [
      "Write one small step toward whatever it's pointing at. Action quiets envy faster than analysis.",
    ],
    closings: [
      "Wanting more for yourself isn't ugly. It's information.",
    ],
  },
  {
    id: "miss-someone",
    label: "Missing someone who hurt you",
    keywords: ["miss him", "miss her", "miss them", "miss my ex", "still love", "can't move on", "cant move on"],
    emotions: ["sad", "attached", "hurt"],
    validations: [
      "Missing someone who hurt you is one of the most confusing kinds of pain. Both things are real.",
    ],
    reflections: [
      "Your nervous system is missing the familiarity, not necessarily the treatment. It will catch up to your decision, just slower than you want.",
    ],
    insights: [
      "Missing them doesn't mean you should go back. Feelings aren't always instructions.",
    ],
    questions: [
      "What are you missing most — the person, the version of you with them, or just not feeling alone?",
    ],
    tinySteps: [
      "When the urge to reach out spikes, write what you'd say in your notes app, then close it. Often the urge is the message, not them.",
    ],
    closings: [
      "Healing isn't forgetting. It's slowly making more room for yourself.",
    ],
  },
  {
    id: "dont-belong",
    label: "Don't belong",
    keywords: ["dont belong", "don't belong", "everyone hates me", "no one likes me", "outsider", "don't fit in", "dont fit in"],
    emotions: ["lonely", "ashamed", "sad"],
    validations: [
      "Feeling like you're on the outside of every room is exhausting and lonely.",
    ],
    reflections: [
      "The brain in this state cherry-picks evidence of rejection and ignores anything warmer.",
    ],
    insights: [
      "Belonging usually starts with one tiny safe person, not a whole group.",
    ],
    questions: [
      "Is there even one person, anywhere, who's ever made you feel a bit safer to be yourself?",
    ],
    tinySteps: [
      "Reach out gently to that one person this week, even just a meme or a 'hi.'",
    ],
    closings: [
      "You're not hard to love. You're tired and unseen, and those are fixable.",
    ],
  },
  {
    id: "thanks",
    label: "Gratitude",
    keywords: ["thank you", "thanks", "ty", "appreciate it", "you helped"],
    validations: [
      "Aw, that means a lot. I'm really glad this helped, even a little.",
      "You did the brave part by showing up and talking. I just listened.",
    ],
    reflections: [
      "Take that softness with you into the rest of your day.",
    ],
    insights: [],
    questions: [
      "Is there anything else sitting on your chest tonight, or are you feeling a bit lighter?",
    ],
    tinySteps: [],
    closings: [
      "I'm here anytime. 💛",
      "Be soft with yourself today.",
    ],
  },
  {
    id: "continue",
    label: "Continue / follow-up",
    keywords: ["continue", "go on", "and then", "yeah", "yes", "ok", "okay", "uh huh", "idk", "i dont know", "i don't know", "same thing", "same as before", "again"],
    validations: [
      "Got it. Let's stay with this.",
      "Mhm, I'm with you. Keep going.",
    ],
    reflections: [
      "I want to make sure I'm following you properly.",
    ],
    insights: [],
    questions: [
      "Can you tell me a bit more about what happened next?",
      "What's the part that's bothering you the most right now?",
    ],
    tinySteps: [],
    closings: [
      "Take your time.",
    ],
  },
];

export const TOPIC_BY_ID: Record<string, TopicPack> = Object.fromEntries(
  TOPIC_PACKS.map((p) => [p.id, p]),
);

// Emotion keyword lexicon (lightweight bag-of-words).
export const EMOTION_WORDS: Record<string, string[]> = {
  sad: ["sad", "down", "low", "crying", "cry", "tears", "blue", "heartbroken", "miserable"],
  numb: ["numb", "empty", "nothing", "blank", "disconnected", "hollow"],
  anxious: ["anxious", "nervous", "worried", "worry", "tense", "on edge", "uneasy", "stressed"],
  panic: ["panic", "panicking", "can't breathe", "cant breathe", "freaking out", "shaking"],
  angry: ["angry", "mad", "furious", "pissed", "rage", "annoyed"],
  guilty: ["guilty", "guilt", "my fault", "shouldn't have", "shouldnt have"],
  ashamed: ["ashamed", "embarrassed", "humiliated", "shame", "want to disappear"],
  confused: ["confused", "don't know", "dont know", "no idea", "lost", "unsure"],
  scared: ["scared", "afraid", "terrified", "fear", "frightened"],
  overwhelmed: ["overwhelmed", "too much", "drowning", "can't cope", "cant cope", "swamped"],
  rejected: ["rejected", "ignored", "left out", "ghosted", "no reply", "abandoned"],
  lonely: ["lonely", "alone", "no friends", "no one", "isolated"],
  excited: ["excited", "happy", "yay", "thrilled", "stoked"],
  attached: ["obsessed", "can't stop thinking", "cant stop thinking", "miss him", "miss her", "miss them"],
  hurt: ["hurt", "wounded", "betrayed", "stung", "broken"],
  tired: ["tired", "exhausted", "drained", "no energy", "burnt out"],
  hopeful: ["hopeful", "better", "improving", "happier"],
};

// Mode-detection phrases.
export const MODE_PHRASES: Record<string, string[]> = {
  vent: ["just listen", "dont give advice", "don't give advice", "i just want to vent", "let me vent", "i need to vent", "no advice"],
  advice: ["what should i do", "tell me what to do", "give me advice", "help me fix", "what would you do", "advice please"],
  questions: ["ask me questions", "ask me something", "ask me anything", "interview me"],
  comfort: ["comfort me", "i need comfort", "i need a hug", "say something nice"],
  calm: ["help me calm down", "help me relax", "i need to calm down", "ground me"],
  "text-help": ["help me text", "help me reply", "what do i say to", "help me write", "draft a message", "what should i text"],
};

// People-mention lexicon.
export const PEOPLE_WORDS = [
  "mom", "mum", "mother", "dad", "father", "parents", "brother", "sister", "sibling",
  "boyfriend", "girlfriend", "bf", "gf", "partner", "ex", "crush", "him", "her",
  "friend", "bestie", "best friend", "roommate", "teacher", "professor", "boss",
];
