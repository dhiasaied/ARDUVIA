import { Injectable, computed, signal } from '@angular/core';
import { Locale } from './models';

export const APP_NAME = 'ARDUVIA';

const en = {
  appTitle: APP_NAME,
  tagline: ['Explore', 'Understand', 'Build'],
  metaTitle: `${APP_NAME} — interactive 3D Arduino lessons for beginners`,
  metaDescription: 'Discover Arduino step by step: 16 interactive 3D lessons, a simulator and a serial monitor, right in your browser.',
  loading: 'Drawing lessons',
  nav: { home: 'Home', lessons: 'Lessons', parts: 'Parts', sim: 'Simulator', settings: 'Settings', language: 'Language', expand: 'Expand sidebar', collapse: 'Collapse sidebar', main: 'Main', dashboard: "Dashboard", tutor: "AI tutor" },
  progressLabel: 'Basics',
  progressAria: 'Progress',
  tabs: { overview: 'Overview', pinout: 'Pinout', example: 'Example', specs: 'Specs' },
  pinHead: ['Pin', 'Wired to', 'Role'],
  howItWorks: 'How the code works',
  specsTitle: 'Specifications',
  pinoutTitle: 'Pinout',
  expandPanel: 'Expand panel',
  collapsePanel: 'Collapse panel',
  code: { title: 'Your turn', expand: 'Expand code', copy: 'Copy code', copied: 'Copied!', run: 'Run the sketch', stop: 'Stop the sketch', reset: 'Restore the original code', serial: 'Serial monitor', stopped: 'Stopped', uploading: 'Uploading…', running: 'Running', error: 'Error', line: 'line', resize: 'Resize serial monitor', compiling: 'Compiling sketch…', uploadingTo: 'Uploading to Arduino Uno…', done: 'Upload complete.', edited: 'edited', noProblems: "No problems", shortcuts: "Ctrl+Space suggestions · Ctrl+Enter run · click a line number for a breakpoint", breakpoints: "Line numbers and breakpoints", breakpointHint: "Toggle breakpoint", variables: "Variables", noVariables: "Run the sketch to inspect its global variables live.", paused: "Paused", pause: "Pause", resume: "Resume", step: "Step to next line", speed: "Simulation speed" },
  lessonsTitle: 'Lessons',
  lessonAria: (n: number, t: string) => `Lesson ${n}: ${t}`,
  prev: 'Previous lessons',
  next: 'More lessons',
  doneCount: (n: number, t: number) => `${n}/${t} done`,
  onScreen: (n: number) => `${n} on screen`,
  settings: {
    language: ['Language', 'Lessons, labels and interface'],
    labels: ['Labels', 'Cards and markers around the 3D view'],
    flow: ['Current flow', 'Moving dots and HIGH / LOW on wires while running'],
    grid: ['Floor grid', 'The subtle grid under the board'],
    autoRotate: ['Turntable', 'Turns a quarter turn every few seconds when idle'],
    sound: ['Sound', 'Let the buzzer play out loud'],
    reducedMotion: ['Reduce motion', 'Near-instant transitions'],
    reset: 'Reset progress',
    confirmReset: 'Erase all your progress?',
  },
  view: { hint: 'Drag or WASD to move · Q / E to rotate · Wheel to zoom', left: 'Rotate left', right: 'Rotate right', zoomOut: 'Zoom out', zoomIn: 'Zoom in', reset: 'Reset view', flow: 'Show current flow', schematic: 'Show schematic', canvas: 'Interactive 3D view. Drag or use WASD to move, Q and E to rotate, the wheel to zoom.', minimap: 'Minimap: click to move the view' },
  schematic: 'Schematic',
  closeSchematic: 'Close schematic',
  inspector: 'Part inspector',
  close: 'Close',
  credit: 'Built with',
  creditLink: 'Angular · Symfony',
  noWebgl: ['3D view unavailable', 'Your browser does not support WebGL. Lessons and the simulator still work.'],
  offline: 'Offline — progress saved locally',
  langNames: { en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic' } as Record<Locale, string>,
  complete: 'Lesson complete!',
  ai: { open: "Ask the AI tutor", short: "Tutor", title: "Learning assistant", placeholder: "Ask anything about this lesson…", send: "Send", explain: "Explain my code", debug: "Why doesn’t it work?", hint: "Hint for the challenge", claude: "Answered by Claude", offline: "Offline tutor", thinking: "Thinking…", error: "The tutor is unavailable right now. Please try again.", rate: "Too many questions — please wait a moment.", intro: "Hi! I’m your ARDUVIA tutor. I can explain your code, track down bugs and nudge you towards the challenge.", clear: "Clear conversation", you: "You" },
  challenge: { tab: "Challenge", solved: "Solved — well done!", watching: "Running: ARDUVIA is checking your circuit live…", idle: "Edit the code, then run it — the result is verified automatically.", showHint: "Show hint", hideHint: "Hide hint", askHint: "Ask the tutor", reward: "+150 XP" },
  dash: { title: "Learning dashboard", subtitle: "Your progress, streaks and achievements", level: "Level", xp: "XP", toNext: "XP to next level", streak: "Day streak", best: "Best", lessons: "Lessons", challenges: "Challenges", runs: "Sketch runs", fixes: "Bugs fixed", questions: "Tutor questions", activity: "Activity · last 14 days", achievements: "Achievements", map: "Lesson map", close: "Close dashboard", open: "Open dashboard", locked: "Locked" },
  levels: ["Novice", "Tinkerer", "Apprentice", "Maker", "Builder", "Engineer", "Inventor", "Innovator", "Master", "Legend"],
  achievements: { first_run: ["First spark", "Run your first sketch."], first_lesson: ["Hello, board", "Complete your first lesson."], five_lessons: ["On a roll", "Complete 5 lessons."], all_lessons: ["Graduate", "Complete all 16 lessons."], first_challenge: ["Challenger", "Solve your first challenge."], challenger: ["Problem solver", "Solve 5 challenges."], debugger: ["Bug hunter", "Fix a sketch that failed to compile or crashed."], curious: ["Curious mind", "Ask the tutor a question."], streak_3: ["Three-day streak", "Learn 3 days in a row."], sensor_pro: ["Sensor pro", "Complete every sensor lesson."] },
  celebrate: { levelUp: "Level up!", achievement: "Achievement unlocked", challenge: "Challenge complete!" },
};

export type Strings = typeof en;

const fr: Strings = {
  appTitle: APP_NAME,
  tagline: ['Explorer', 'Comprendre', 'Construire'],
  metaTitle: `${APP_NAME} — leçons Arduino interactives en 3D pour débutants`,
  metaDescription: 'Découvrez Arduino pas à pas : 16 leçons interactives en 3D, un simulateur et un moniteur série dans le navigateur.',
  loading: 'Dessin des leçons',
  nav: { home: 'Accueil', lessons: 'Leçons', parts: 'Composants', sim: 'Simulateur', settings: 'Réglages', language: 'Langue', expand: 'Agrandir la barre latérale', collapse: 'Réduire la barre latérale', main: 'Principal', dashboard: "Tableau de bord", tutor: "Tuteur IA" },
  progressLabel: 'Bases',
  progressAria: 'Progression',
  tabs: { overview: 'Aperçu', pinout: 'Brochage', example: 'Exemple', specs: 'Spécifications' },
  pinHead: ['Broche', 'Relié à', 'Rôle'],
  howItWorks: 'Comment fonctionne le code',
  specsTitle: 'Spécifications',
  pinoutTitle: 'Brochage',
  expandPanel: 'Agrandir le panneau',
  collapsePanel: 'Réduire le panneau',
  code: { title: 'À vous de jouer', expand: 'Agrandir le code', copy: 'Copier le code', copied: 'Copié !', run: 'Exécuter le programme', stop: 'Arrêter le programme', reset: 'Rétablir le code d’origine', serial: 'Moniteur série', stopped: 'Arrêté', uploading: 'Téléversement…', running: 'En cours', error: 'Erreur', line: 'ligne', resize: 'Redimensionner le moniteur série', compiling: 'Compilation du croquis…', uploadingTo: 'Téléversement vers l’Arduino Uno…', done: 'Téléversement terminé.', edited: 'modifié', noProblems: "Aucun problème", shortcuts: "Ctrl+Espace suggestions · Ctrl+Entrée exécuter · cliquez un numéro de ligne pour un point d’arrêt", breakpoints: "Numéros de ligne et points d’arrêt", breakpointHint: "Basculer le point d’arrêt", variables: "Variables", noVariables: "Lancez le croquis pour inspecter ses variables globales en direct.", paused: "En pause", pause: "Pause", resume: "Reprendre", step: "Pas à pas", speed: "Vitesse de simulation" },
  lessonsTitle: 'Leçons',
  lessonAria: (n, t) => `Leçon ${n} : ${t}`,
  prev: 'Leçons précédentes',
  next: 'Plus de leçons',
  doneCount: (n, t) => `${n}/${t} terminées`,
  onScreen: (n) => `${n} à l’écran`,
  settings: {
    language: ['Langue', 'Leçons, étiquettes et interface'],
    labels: ['Étiquettes', 'Cartes et repères autour de la vue 3D'],
    flow: ['Circulation du courant', 'Points mobiles et HIGH / LOW sur les fils pendant l’exécution'],
    grid: ['Grille au sol', 'La grille discrète sous la carte'],
    autoRotate: ['Plateau tournant', 'Tourne d’un quart de tour toutes les quelques secondes au repos'],
    sound: ['Son', 'Laisser le buzzer jouer à voix haute'],
    reducedMotion: ['Réduire les animations', 'Transitions quasi instantanées'],
    reset: 'Réinitialiser la progression',
    confirmReset: 'Effacer toute votre progression ?',
  },
  view: { hint: 'Glisser ou WASD pour se déplacer · Q / E pour pivoter · Molette pour zoomer', left: 'Pivoter à gauche', right: 'Pivoter à droite', zoomOut: 'Dézoomer', zoomIn: 'Zoomer', reset: 'Réinitialiser la vue', flow: 'Afficher la circulation du courant', schematic: 'Afficher le schéma', canvas: 'Vue 3D interactive. Faites glisser ou utilisez WASD pour vous déplacer, Q et E pour pivoter, la molette pour zoomer.', minimap: 'Mini-carte : cliquez pour déplacer la vue' },
  schematic: 'Schéma',
  closeSchematic: 'Fermer le schéma',
  inspector: 'Inspecteur de composant',
  close: 'Fermer',
  credit: 'Conçu avec',
  creditLink: 'Angular · Symfony',
  noWebgl: ['Vue 3D indisponible', 'Votre navigateur ne prend pas en charge WebGL. Les leçons et le simulateur restent utilisables.'],
  offline: 'Hors ligne — progression enregistrée localement',
  langNames: { en: 'Anglais', fr: 'Français', es: 'Espagnol', ar: 'Arabe' },
  complete: 'Leçon terminée !',
  ai: { open: "Demander au tuteur IA", short: "Tuteur", title: "Assistant d’apprentissage", placeholder: "Posez une question sur cette leçon…", send: "Envoyer", explain: "Expliquer mon code", debug: "Pourquoi ça ne marche pas ?", hint: "Indice pour le défi", claude: "Réponse de Claude", offline: "Tuteur hors ligne", thinking: "Réflexion…", error: "Le tuteur est indisponible pour le moment. Réessayez.", rate: "Trop de questions — patientez un instant.", intro: "Bonjour ! Je suis votre tuteur ARDUVIA. J’explique votre code, je traque les bugs et je vous guide vers le défi.", clear: "Effacer la conversation", you: "Vous" },
  challenge: { tab: "Défi", solved: "Réussi — bravo !", watching: "En cours : ARDUVIA vérifie votre circuit en direct…", idle: "Modifiez le code puis exécutez-le : le résultat est vérifié automatiquement.", showHint: "Afficher l’indice", hideHint: "Masquer l’indice", askHint: "Demander au tuteur", reward: "+150 XP" },
  dash: { title: "Tableau de bord", subtitle: "Votre progression, vos séries et vos succès", level: "Niveau", xp: "XP", toNext: "XP avant le niveau suivant", streak: "Jours d’affilée", best: "Record", lessons: "Leçons", challenges: "Défis", runs: "Exécutions", fixes: "Bugs corrigés", questions: "Questions au tuteur", activity: "Activité · 14 derniers jours", achievements: "Succès", map: "Carte des leçons", close: "Fermer le tableau de bord", open: "Ouvrir le tableau de bord", locked: "Verrouillé" },
  levels: ["Novice", "Bricoleur", "Apprenti", "Maker", "Bâtisseur", "Ingénieur", "Inventeur", "Innovateur", "Maître", "Légende"],
  achievements: { first_run: ["Première étincelle", "Exécutez votre premier croquis."], first_lesson: ["Bonjour, la carte", "Terminez votre première leçon."], five_lessons: ["Lancé !", "Terminez 5 leçons."], all_lessons: ["Diplômé", "Terminez les 16 leçons."], first_challenge: ["Challenger", "Réussissez votre premier défi."], challenger: ["Résolveur", "Réussissez 5 défis."], debugger: ["Chasseur de bugs", "Corrigez un croquis qui ne compilait pas ou plantait."], curious: ["Esprit curieux", "Posez une question au tuteur."], streak_3: ["Trois jours de suite", "Apprenez 3 jours d’affilée."], sensor_pro: ["Pro des capteurs", "Terminez toutes les leçons de capteurs."] },
  celebrate: { levelUp: "Niveau supérieur !", achievement: "Succès débloqué", challenge: "Défi réussi !" },
};

const es: Strings = {
  appTitle: APP_NAME,
  tagline: ['Explorar', 'Comprender', 'Construir'],
  metaTitle: `${APP_NAME} — lecciones interactivas de Arduino en 3D para principiantes`,
  metaDescription: 'Descubre Arduino paso a paso: 16 lecciones interactivas en 3D, un simulador y un monitor serie en tu navegador.',
  loading: 'Dibujando las lecciones',
  nav: { home: 'Inicio', lessons: 'Lecciones', parts: 'Componentes', sim: 'Simulador', settings: 'Ajustes', language: 'Idioma', expand: 'Expandir la barra lateral', collapse: 'Contraer la barra lateral', main: 'Principal', dashboard: "Panel", tutor: "Tutor IA" },
  progressLabel: 'Fundamentos',
  progressAria: 'Progreso',
  tabs: { overview: 'Resumen', pinout: 'Pines', example: 'Ejemplo', specs: 'Especificaciones' },
  pinHead: ['Pin', 'Conectado a', 'Función'],
  howItWorks: 'Cómo funciona el código',
  specsTitle: 'Especificaciones',
  pinoutTitle: 'Pines',
  expandPanel: 'Ampliar el panel',
  collapsePanel: 'Reducir el panel',
  code: { title: 'Tu turno', expand: 'Ampliar el código', copy: 'Copiar el código', copied: '¡Copiado!', run: 'Ejecutar el programa', stop: 'Detener el programa', reset: 'Restaurar el código original', serial: 'Monitor serie', stopped: 'Detenido', uploading: 'Cargando…', running: 'En marcha', error: 'Error', line: 'línea', resize: 'Redimensionar el monitor serie', compiling: 'Compilando el sketch…', uploadingTo: 'Cargando en el Arduino Uno…', done: 'Carga completada.', edited: 'modificado', noProblems: "Sin problemas", shortcuts: "Ctrl+Espacio sugerencias · Ctrl+Intro ejecutar · haz clic en un número de línea para un punto de interrupción", breakpoints: "Números de línea y puntos de interrupción", breakpointHint: "Alternar punto de interrupción", variables: "Variables", noVariables: "Ejecuta el sketch para inspeccionar sus variables globales en directo.", paused: "En pausa", pause: "Pausar", resume: "Reanudar", step: "Paso a paso", speed: "Velocidad de simulación" },
  lessonsTitle: 'Lecciones',
  lessonAria: (n, t) => `Lección ${n}: ${t}`,
  prev: 'Lecciones anteriores',
  next: 'Más lecciones',
  doneCount: (n, t) => `${n}/${t} completadas`,
  onScreen: (n) => `${n} en pantalla`,
  settings: {
    language: ['Idioma', 'Lecciones, etiquetas e interfaz'],
    labels: ['Etiquetas', 'Tarjetas y marcadores alrededor de la vista 3D'],
    flow: ['Flujo de corriente', 'Puntos en movimiento y HIGH / LOW en los cables durante la ejecución'],
    grid: ['Cuadrícula', 'La cuadrícula discreta bajo la placa'],
    autoRotate: ['Plataforma giratoria', 'Gira un cuarto de vuelta cada pocos segundos en reposo'],
    sound: ['Sonido', 'Dejar que el zumbador suene en voz alta'],
    reducedMotion: ['Reducir animaciones', 'Transiciones casi instantáneas'],
    reset: 'Restablecer el progreso',
    confirmReset: '¿Borrar todo tu progreso?',
  },
  view: { hint: 'Arrastra o WASD para moverte · Q / E para girar · Rueda para hacer zoom', left: 'Girar a la izquierda', right: 'Girar a la derecha', zoomOut: 'Alejar', zoomIn: 'Acercar', reset: 'Restablecer la vista', flow: 'Mostrar el flujo de corriente', schematic: 'Mostrar el esquema', canvas: 'Vista 3D interactiva. Arrastra o usa WASD para moverte, Q y E para girar y la rueda para hacer zoom.', minimap: 'Minimapa: haz clic para mover la vista' },
  schematic: 'Esquema',
  closeSchematic: 'Cerrar el esquema',
  inspector: 'Inspector de componentes',
  close: 'Cerrar',
  credit: 'Creado con',
  creditLink: 'Angular · Symfony',
  noWebgl: ['Vista 3D no disponible', 'Tu navegador no admite WebGL. Las lecciones y el simulador siguen funcionando.'],
  offline: 'Sin conexión — progreso guardado localmente',
  langNames: { en: 'Inglés', fr: 'Francés', es: 'Español', ar: 'Árabe' },
  complete: '¡Lección completada!',
  ai: { open: "Preguntar al tutor IA", short: "Tutor", title: "Asistente de aprendizaje", placeholder: "Pregunta lo que quieras sobre esta lección…", send: "Enviar", explain: "Explica mi código", debug: "¿Por qué no funciona?", hint: "Pista para el reto", claude: "Respuesta de Claude", offline: "Tutor sin conexión", thinking: "Pensando…", error: "El tutor no está disponible ahora. Inténtalo de nuevo.", rate: "Demasiadas preguntas — espera un momento.", intro: "¡Hola! Soy tu tutor de ARDUVIA. Explico tu código, busco errores y te oriento hacia el reto.", clear: "Borrar la conversación", you: "Tú" },
  challenge: { tab: "Reto", solved: "¡Superado, enhorabuena!", watching: "En marcha: ARDUVIA comprueba tu circuito en directo…", idle: "Edita el código y ejecútalo: el resultado se verifica automáticamente.", showHint: "Mostrar pista", hideHint: "Ocultar pista", askHint: "Preguntar al tutor", reward: "+150 XP" },
  dash: { title: "Panel de aprendizaje", subtitle: "Tu progreso, rachas y logros", level: "Nivel", xp: "XP", toNext: "XP para el siguiente nivel", streak: "Días seguidos", best: "Récord", lessons: "Lecciones", challenges: "Retos", runs: "Ejecuciones", fixes: "Errores corregidos", questions: "Preguntas al tutor", activity: "Actividad · últimos 14 días", achievements: "Logros", map: "Mapa de lecciones", close: "Cerrar el panel", open: "Abrir el panel", locked: "Bloqueado" },
  levels: ["Novato", "Manitas", "Aprendiz", "Maker", "Constructor", "Ingeniero", "Inventor", "Innovador", "Maestro", "Leyenda"],
  achievements: { first_run: ["Primera chispa", "Ejecuta tu primer sketch."], first_lesson: ["Hola, placa", "Completa tu primera lección."], five_lessons: ["En racha", "Completa 5 lecciones."], all_lessons: ["Graduado", "Completa las 16 lecciones."], first_challenge: ["Retador", "Supera tu primer reto."], challenger: ["Solucionador", "Supera 5 retos."], debugger: ["Cazador de errores", "Corrige un sketch que no compilaba o fallaba."], curious: ["Mente curiosa", "Hazle una pregunta al tutor."], streak_3: ["Racha de tres días", "Aprende 3 días seguidos."], sensor_pro: ["Experto en sensores", "Completa todas las lecciones de sensores."] },
  celebrate: { levelUp: "¡Subes de nivel!", achievement: "Logro desbloqueado", challenge: "¡Reto superado!" },
};

const ar: Strings = {
  appTitle: APP_NAME,
  tagline: ['استكشف', 'افهم', 'ابنِ'],
  metaTitle: `${APP_NAME} — دروس Arduino تفاعلية ثلاثية الأبعاد للمبتدئين`,
  metaDescription: 'تعلّم Arduino خطوة بخطوة: 16 درسًا تفاعليًا ثلاثي الأبعاد ومحاكٍ وشاشة تسلسلية مباشرة في متصفحك.',
  loading: 'جارٍ رسم الدروس',
  nav: { home: 'الرئيسية', lessons: 'الدروس', parts: 'المكونات', sim: 'المحاكي', settings: 'الإعدادات', language: 'اللغة', expand: 'توسيع الشريط الجانبي', collapse: 'طيّ الشريط الجانبي', main: 'القائمة الرئيسية', dashboard: "لوحة التقدّم", tutor: "المعلّم الذكي" },
  progressLabel: 'الأساسيات',
  progressAria: 'التقدّم',
  tabs: { overview: 'نظرة عامة', pinout: 'المنافذ', example: 'مثال', specs: 'المواصفات' },
  pinHead: ['المنفذ', 'متصل بـ', 'الوظيفة'],
  howItWorks: 'كيف تعمل الشيفرة',
  specsTitle: 'المواصفات',
  pinoutTitle: 'المنافذ',
  expandPanel: 'توسيع اللوحة',
  collapsePanel: 'تصغير اللوحة',
  code: { title: 'دورك الآن', expand: 'توسيع الشيفرة', copy: 'نسخ الشيفرة', copied: 'تم النسخ!', run: 'تشغيل البرنامج', stop: 'إيقاف البرنامج', reset: 'استعادة الشيفرة الأصلية', serial: 'الشاشة التسلسلية', stopped: 'متوقف', uploading: 'جارٍ الرفع…', running: 'قيد التشغيل', error: 'خطأ', line: 'السطر', resize: 'تغيير حجم الشاشة التسلسلية', compiling: 'جارٍ ترجمة البرنامج…', uploadingTo: 'جارٍ الرفع إلى Arduino Uno…', done: 'اكتمل الرفع.', edited: 'معدّلة', noProblems: "لا توجد مشكلات", shortcuts: "Ctrl+Space اقتراحات · Ctrl+Enter تشغيل · انقر رقم سطر لإضافة نقطة توقف", breakpoints: "أرقام الأسطر ونقاط التوقف", breakpointHint: "تبديل نقطة التوقف", variables: "المتغيرات", noVariables: "شغّل البرنامج لمعاينة متغيراته العامة مباشرة.", paused: "متوقف مؤقتًا", pause: "إيقاف مؤقت", resume: "متابعة", step: "السطر التالي", speed: "سرعة المحاكاة" },
  lessonsTitle: 'الدروس',
  lessonAria: (n, t) => `الدرس ${n}: ${t}`,
  prev: 'الدروس السابقة',
  next: 'مزيد من الدروس',
  doneCount: (n, t) => `${n}/${t} مكتملة`,
  onScreen: (n) => `${n} على الشاشة`,
  settings: {
    language: ['اللغة', 'الدروس والتسميات والواجهة'],
    labels: ['التسميات', 'البطاقات والعلامات حول العرض ثلاثي الأبعاد'],
    flow: ['سريان التيار', 'نقاط متحركة وHIGH / LOW على الأسلاك أثناء التشغيل'],
    grid: ['شبكة الأرضية', 'الشبكة الخفيفة أسفل اللوحة'],
    autoRotate: ['القاعدة الدوّارة', 'تدور ربع دورة كل بضع ثوانٍ عند الخمول'],
    sound: ['الصوت', 'السماح للطنّان بإصدار الصوت'],
    reducedMotion: ['تقليل الحركة', 'انتقالات شبه فورية'],
    reset: 'إعادة ضبط التقدّم',
    confirmReset: 'هل تريد مسح كل تقدّمك؟',
  },
  view: { hint: 'اسحب أو استخدم WASD للتنقل · Q / E للتدوير · العجلة للتكبير', left: 'تدوير لليسار', right: 'تدوير لليمين', zoomOut: 'تصغير', zoomIn: 'تكبير', reset: 'إعادة ضبط العرض', flow: 'إظهار سريان التيار', schematic: 'إظهار المخطط', canvas: 'عرض تفاعلي ثلاثي الأبعاد. اسحب أو استخدم WASD للتنقل، وQ وE للتدوير، والعجلة للتكبير.', minimap: 'الخريطة المصغرة: انقر لتحريك العرض' },
  schematic: 'المخطط',
  closeSchematic: 'إغلاق المخطط',
  inspector: 'فاحص المكونات',
  close: 'إغلاق',
  credit: 'صُمّم باستخدام',
  creditLink: 'Angular · Symfony',
  noWebgl: ['العرض ثلاثي الأبعاد غير متاح', 'متصفحك لا يدعم WebGL. تظل الدروس والمحاكي قابلة للاستخدام.'],
  offline: 'غير متصل — حُفظ التقدّم محليًا',
  langNames: { en: 'الإنجليزية', fr: 'الفرنسية', es: 'الإسبانية', ar: 'العربية' },
  complete: 'اكتمل الدرس!',
  ai: { open: "اسأل المعلّم الذكي", short: "المعلّم", title: "مساعد التعلّم", placeholder: "اسأل أي شيء عن هذا الدرس…", send: "إرسال", explain: "اشرح شيفرتي", debug: "لماذا لا تعمل؟", hint: "تلميح للتحدي", claude: "إجابة من Claude", offline: "المعلّم دون اتصال", thinking: "جارٍ التفكير…", error: "المعلّم غير متاح حاليًا. حاول مجددًا.", rate: "أسئلة كثيرة — انتظر قليلًا.", intro: "مرحبًا! أنا معلّمك في ARDUVIA. أشرح شيفرتك وأتتبع الأخطاء وأرشدك نحو التحدي.", clear: "مسح المحادثة", you: "أنت" },
  challenge: { tab: "التحدي", solved: "تم الحل — أحسنت!", watching: "قيد التشغيل: يتحقق ARDUVIA من دارتك مباشرة…", idle: "عدّل الشيفرة ثم شغّلها — يتم التحقق من النتيجة تلقائيًا.", showHint: "إظهار التلميح", hideHint: "إخفاء التلميح", askHint: "اسأل المعلّم", reward: "+150 XP" },
  dash: { title: "لوحة التقدّم", subtitle: "تقدّمك وسلاسل أيامك وإنجازاتك", level: "المستوى", xp: "XP", toNext: "XP للمستوى التالي", streak: "أيام متتالية", best: "الأفضل", lessons: "الدروس", challenges: "التحديات", runs: "مرات التشغيل", fixes: "أخطاء مُصلحة", questions: "أسئلة للمعلّم", activity: "النشاط · آخر 14 يومًا", achievements: "الإنجازات", map: "خريطة الدروس", close: "إغلاق لوحة التقدّم", open: "فتح لوحة التقدّم", locked: "مقفل" },
  levels: ["مبتدئ", "هاوٍ", "متدرّب", "صانع", "باني", "مهندس", "مخترع", "مبتكر", "خبير", "أسطورة"],
  achievements: { first_run: ["الشرارة الأولى", "شغّل برنامجك الأول."], first_lesson: ["مرحبًا باللوحة", "أكمل درسك الأول."], five_lessons: ["على الطريق", "أكمل 5 دروس."], all_lessons: ["متخرّج", "أكمل الدروس الستة عشر."], first_challenge: ["المتحدّي", "احلّ تحديك الأول."], challenger: ["حلّال المشكلات", "احلّ 5 تحديات."], debugger: ["صيّاد الأخطاء", "أصلح برنامجًا فشلت ترجمته أو تعطّل."], curious: ["عقل فضولي", "اطرح سؤالًا على المعلّم."], streak_3: ["ثلاثة أيام متتالية", "تعلّم 3 أيام متتالية."], sensor_pro: ["محترف المستشعرات", "أكمل كل دروس المستشعرات."] },
  celebrate: { levelUp: "ارتقيت مستوى!", achievement: "إنجاز جديد", challenge: "تم حل التحدي!" },
};

const STRINGS: Record<Locale, Strings> = { en, fr, es, ar };

export const LOCALES: Locale[] = ['en', 'fr', 'es', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';
export const RTL_LOCALES: Locale[] = ['ar'];

export const LANGUAGES: { code: Locale; native: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'fr', native: 'Français', dir: 'ltr' },
  { code: 'es', native: 'Español', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
];

const LOCALE_KEY = 'arduvia.locale';

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as string[]).includes(v);
}

/** The learner's last chosen language (used for the bare "/" URL). */
export function preferredLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* storage unavailable */ }
  return DEFAULT_LOCALE;
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly locale = signal<Locale>(DEFAULT_LOCALE);
  readonly t = computed<Strings>(() => STRINGS[this.locale()]);
  readonly dir = computed<'ltr' | 'rtl'>(() => (RTL_LOCALES.includes(this.locale()) ? 'rtl' : 'ltr'));

  set(locale: string | null | undefined): Locale {
    const l: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    this.locale.set(l);
    const root = document.documentElement;
    root.lang = l;
    root.dir = RTL_LOCALES.includes(l) ? 'rtl' : 'ltr';
    try { localStorage.setItem(LOCALE_KEY, l); } catch { /* storage unavailable */ }
    return l;
  }
}
