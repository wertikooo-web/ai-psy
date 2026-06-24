export interface GptItem {
  id: string;
  emoji: string;
  name: string;
  description: string;
  url: string;
}

export interface GptGroup {
  id: string;
  label: string;
  items: GptItem[];
}

export const PSY_GPTS_GROUPS: GptGroup[] = [
  {
    id: "professional",
    label: "Для психологов и специалистов",
    items: [
      {
        id: "transcript-ai-psy",
        emoji: "🚩",
        name: "TRANSCRIPT AI – PSY",
        description: "Анализирует транскрипты консультаций, помогает выделить темы, эмоции, противоречия, ресурсы и рабочие гипотезы.",
        url: "https://chatgpt.com/g/g-6a39895c066481919568675af786bde7-transcript-ai-psy",
      },
      {
        id: "psyscan-ai",
        emoji: "🔴",
        name: "PsyScan AI",
        description: "Продвинутый AI-ассистент для психологов: препарирует клиентские кейсы через призму гештальт-терапии и других подходов. Помогает выявить незавершённые гештальты, когнитивные искажения, внутренние конфликты и семейные сценарии.",
        url: "https://chatgpt.com/g/g-684aab198b008191b641cfc7486e2556-psyscan-ai-umnyi-analiz-psikhologicheskikh-keisov",
      },
      {
        id: "psysearch-pro",
        emoji: "🔴",
        name: "PsySearch Pro",
        description: "Ищет, извлекает и структурирует техники и упражнения из загруженных документов (PDF, DOCX, TXT) и дополнительных ресурсов.",
        url: "https://chatgpt.com/g/g-68597ffed06881918f600eececd73e87-psysearch-pro",
      },
      {
        id: "supervise-ai",
        emoji: "🎯",
        name: "Supervise AI",
        description: "Инструмент психологической супервизии на базе AI. Содержит базу вопросов для супервизии и ссылки на исследования.",
        url: "https://chatgpt.com/g/g-686fd15343c481919277a8fbf1201764-supervise-ai",
      },
      {
        id: "psycontent-ai",
        emoji: "🛠️",
        name: "PsyContent AI",
        description: "Этичный контент-автор для психологов: создаёт живые, вовлекающие посты, помогающие говорить о психологии открыто и мягко привлекать клиентов через соцсети.",
        url: "https://chatgpt.com/g/g-687fdb0888fc8191af8be137fa977658-psycontent-ai-kontent-avtor-dlia-psikhologov",
      },
      {
        id: "ekspert-logoped",
        emoji: "👤",
        name: "Эксперт-логопед",
        description: "Проводит аттестацию логопедов через анализ реальных кейсов. Оценивает ответы по 5 критериям: Анализ, Проблема, Прогноз, Действия, Результат. Строго следует Кодексу об образовании РМ и Стандартам 0–7 лет.",
        url: "https://chatgpt.com/g/g-6963d8b89240819188c49372df5993cb-ekspert-logoped",
      },
      {
        id: "clarity-ai",
        emoji: "👀",
        name: "CLARITY AI",
        description: "AI для ясности мышления и принятия решений для пар. Содержит 100+ профессиональных вопросов, 225 примеров коммуникации, 50 вопросов по неопределённости и выбору.",
        url: "https://chatgpt.com/g/g-694edce2360881918eb9b99df3725743-clarity-ai-the-connection-questions",
      },
      {
        id: "gestalt-teacher",
        emoji: "👤",
        name: "GESTALT-TEACHER AI",
        description: "Помогает психологу легко объяснять сложные гештальт-концепции простым языком: себе, клиентам, студентам, подписчикам. Структурирует мысли, даёт готовые примеры, показывает техники через живой текст.",
        url: "https://chatgpt.com/g/g-68753a4ff3c48191a7bf4f0c68adb72d-gestalt-teacher",
      },
      {
        id: "ai-super-logoped",
        emoji: "👧",
        name: "AI SUPER LOGOPED Navigator",
        description: "Анализирует описание ребёнка, предлагает логопедические гипотезы, составляет индивидуальные планы коррекции, подбирает упражнения, слова, игры и готовые конспекты занятий.",
        url: "https://chatgpt.com/g/g-69161e042cd88191b34084f5c55c897c-ai-super-logoped-navigator",
      },
      {
        id: "psychotext",
        emoji: "🚩",
        name: "PSYCHOTEXT",
        description: "Агент-копирайтер для психологов, создающий эмоционально точные посты в Facebook. Пишет от первого лица, вызывает отклик, помогает строить доверие и мягко приглашает к терапевтическому контакту.",
        url: "https://chatgpt.com/g/g-68752d798b6c81918d7818d4f22bfc3b-psychotext-agent-kopiraiter-dlia-psikhologov",
      },
      {
        id: "psychowrite-ai",
        emoji: "🎲",
        name: "PsychoWrite AI",
        description: "Интеллектуальный ассистент для психологов, ежедневно создающий эмоционально точные, живые и вовлекающие посты. Говорит с читателем просто, глубоко и с заботой.",
        url: "https://chatgpt.com/g/g-685564166b508191be69e303eb715fcb-psychowrite-ai-content-with-empathy",
      },
    ],
  },
  {
    id: "additional",
    label: "Дополнительные GPTs",
    items: [
      {
        id: "replicon-ai",
        emoji: "🤺",
        name: "REPLICON AI",
        description: "Помощник по управленческим кейсам, спорам и переговорам. Анализирует позиции сторон, предлагает аргументы, находит уязвимости, формирует тактику для сложных диалогов.",
        url: "https://chatgpt.com/g/g-67eae91901dc8191b0f3a773cefb004d-replicon-ai-ekspert-po-upravlencheskim-keisam",
      },
      {
        id: "image-director",
        emoji: "🔴",
        name: "Image Director",
        description: "AI-арт-директор и навигатор по библиотеке промтов для изображений. Помогает выбрать стиль, найти лучшие визуальные решения и создавать сильные промты для генерации изображений.",
        url: "https://chatgpt.com/g/g-6a1f00979fec8191a7f4ef1033cd5dda-image-director",
      },
      {
        id: "ai-decision-lens",
        emoji: "👀",
        name: "AI Decision Lens",
        description: "Инструмент принятия решений через призму AI-анализа. Содержит описание системы и инструкции по использованию.",
        url: "https://chatgpt.com/g/g-684368c6c37c819199bfed81ea094027-ai-decision-lens-pomoshch-v-priniatii-reshenii",
      },
      {
        id: "logowiz-ai",
        emoji: "🤗",
        name: "LogoWiz AI",
        description: "Цифровой логопед-ассистент в образе сказочной феи, который помогает детям 4–7 лет развивать речь, внимание и мышление через игровые онлайн-сказки и интерактивные упражнения.",
        url: "https://chatgpt.com/g/g-6854f6eafb388191b85a39b97f5c4b72-logowiz-ai-skazochnyi-pomoshchnik-v-razvitii-rechi",
      },
      {
        id: "natural-text",
        emoji: "👀",
        name: "NATURAL.TEXT AI",
        description: "Помощник для редактирования любых текстов в живом, естественном и понятном стиле. Поддерживает выбор тона, стиля, роли и исключает клише и искусственность.",
        url: "https://chatgpt.com/g/g-68906da2cebc8191813baaa4a214f8d2-natural-text",
      },
      {
        id: "personal-risk-scanner",
        emoji: "🚩",
        name: "Personal Risk Scanner",
        description: "AI-навигатор, помогающий понять, насколько ваша профессия или бизнес могут быть затронуты AI. Оценивает риски, потенциал роста и даёт конкретный план действий.",
        url: "https://chatgpt.com/g/g-69a2c6fe70788191af87aef315235948-personal-risk-scanner",
      },
      {
        id: "mymagictale",
        emoji: "🔴",
        name: "MY MAGIC TAIL AI",
        description: "Волшебный AI-друг, который сочинит сказку для вашего ребёнка или про него. Укажите интересы и настроение — и получите тёплую, весёлую или поучительную историю с магией и приключениями.",
        url: "https://chatgpt.com/g/g-68591ab959c08191bfbe2ee2f4eeb967-mymagictale",
      },
      {
        id: "skillup-teen",
        emoji: "🔴",
        name: "Skill_Up Teen AI",
        description: "AI-тренер soft skills для подростков 12–18 лет. Содержит 101 жизненный навык и 30 лучших подростковых вопросов. Помогает прокачать аргументацию, уверенность и эмпатию.",
        url: "https://chatgpt.com/g/g-6878bb872b208191a4931eb92cb75d17-skillup-teen-trener-soft-skills-dlia-podrostkov",
      },
    ],
  },
];
