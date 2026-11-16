<?php

namespace App\Service;

/**
 * Offline, rule-based tutor used when no Claude credentials are configured
 * (or the API is unavailable). It explains the simulator's compiler errors and
 * walks through the lesson's own content, in the learner's language.
 */
final class LocalTutor
{
    /** pattern => [en, fr, es, ar] */
    private const ERRORS = [
        "/expected ';'/" => [
            'A statement is missing its **semicolon**. In Arduino C++ every instruction ends with `;` — check the end of the line shown, or the line just above it.',
            'Il manque un **point-virgule**. En C++ Arduino, chaque instruction se termine par `;` : vérifiez la fin de la ligne indiquée, ou celle juste au-dessus.',
            'Falta un **punto y coma**. En C++ de Arduino cada instrucción termina en `;`: revisa el final de la línea indicada o la de justo encima.',
            'تنقص **فاصلة منقوطة**. في لغة C++ الخاصة بـ Arduino تنتهي كل تعليمة بـ `;` — تحقّق من نهاية السطر المشار إليه أو السطر الذي قبله.',
        ],
        '/was not declared in this scope/' => [
            'The compiler does not know this name. Check its **spelling and capitalisation** (`digitalWrite`, not `digitalwrite`), and make sure variables are declared before you use them.',
            'Le compilateur ne connaît pas ce nom. Vérifiez **l’orthographe et les majuscules** (`digitalWrite`, pas `digitalwrite`) et déclarez vos variables avant de les utiliser.',
            'El compilador no conoce ese nombre. Revisa la **ortografía y las mayúsculas** (`digitalWrite`, no `digitalwrite`) y declara las variables antes de usarlas.',
            'المترجم لا يعرف هذا الاسم. تحقّق من **التهجئة والأحرف الكبيرة** (`digitalWrite` وليس `digitalwrite`)، وتأكّد من التصريح عن المتغيرات قبل استخدامها.',
        ],
        '/does not name a type/' => [
            'An instruction is **outside a function**. Only declarations may live at the top level — move this line into `setup()` or `loop()`.',
            'Une instruction se trouve **en dehors d’une fonction**. Seules les déclarations sont permises au niveau global : déplacez cette ligne dans `setup()` ou `loop()`.',
            'Hay una instrucción **fuera de una función**. En el nivel global solo se permiten declaraciones: mueve esta línea a `setup()` o `loop()`.',
            'هناك تعليمة **خارج أي دالة**. يُسمح بالتصريحات فقط في المستوى العام — انقل هذا السطر إلى `setup()` أو `loop()`.',
        ],
        "/expected '[{}]'|at end of input/" => [
            'The **braces don’t match**. Every `{` needs a closing `}` — count them in `setup()`, `loop()` and each `if` / `for` block.',
            'Les **accolades ne correspondent pas**. Chaque `{` doit avoir son `}` : comptez-les dans `setup()`, `loop()` et chaque bloc `if` / `for`.',
            'Las **llaves no coinciden**. Cada `{` necesita su `}`: cuéntalas en `setup()`, `loop()` y en cada bloque `if` / `for`.',
            '**الأقواس المعقوفة غير متطابقة**. كل `{` يحتاج إلى `}` يغلقه — عُدّها في `setup()` و`loop()` وفي كل كتلة `if` / `for`.',
        ],
        '/too few arguments|wrong number of arguments/' => [
            'A function received the **wrong number of arguments**. For example `digitalWrite` needs two: the pin and `HIGH`/`LOW`.',
            'Une fonction a reçu un **mauvais nombre d’arguments**. Par exemple `digitalWrite` en attend deux : la broche et `HIGH`/`LOW`.',
            'Una función recibió un **número incorrecto de argumentos**. Por ejemplo, `digitalWrite` necesita dos: el pin y `HIGH`/`LOW`.',
            'تلقّت دالة **عددًا خاطئًا من الوسائط**. مثلًا `digitalWrite` تحتاج إلى وسيطين: المنفذ و`HIGH`/`LOW`.',
        ],
        "/undefined reference to '(setup|loop)'/" => [
            'Every sketch needs both `void setup() { … }` and `void loop() { … }`. One of them is missing or misspelled.',
            'Tout croquis a besoin de `void setup() { … }` et de `void loop() { … }`. L’une des deux manque ou est mal orthographiée.',
            'Todo sketch necesita `void setup() { … }` y `void loop() { … }`. Falta una de las dos o está mal escrita.',
            'يحتاج كل برنامج إلى `void setup() { … }` و`void loop() { … }`. إحداهما مفقودة أو مكتوبة بشكل خاطئ.',
        ],
        '/division by zero/' => [
            'The program **divided by zero** while running. Check the value of the divisor before dividing.',
            'Le programme a **divisé par zéro** pendant l’exécution. Vérifiez la valeur du diviseur avant la division.',
            'El programa **dividió entre cero** durante la ejecución. Comprueba el valor del divisor antes de dividir.',
            'قام البرنامج **بالقسمة على صفر** أثناء التشغيل. تحقّق من قيمة المقسوم عليه قبل القسمة.',
        ],
        '/out of bounds/' => [
            'An **array index is out of range**. Arrays start at index 0, so an array of 4 items goes from `[0]` to `[3]`.',
            'Un **indice de tableau est hors limites**. Les tableaux commencent à 0 : un tableau de 4 éléments va de `[0]` à `[3]`.',
            'Un **índice de array está fuera de rango**. Los arrays empiezan en 0: uno de 4 elementos va de `[0]` a `[3]`.',
            '**فهرس المصفوفة خارج النطاق**. تبدأ المصفوفات من 0، فالمصفوفة ذات 4 عناصر تمتد من `[0]` إلى `[3]`.',
        ],
        '/missing terminating quote/' => [
            'A **text string is not closed**. Strings start and end with `"` on the same line.',
            'Une **chaîne de texte n’est pas fermée**. Une chaîne commence et finit par `"` sur la même ligne.',
            'Una **cadena de texto no está cerrada**. Las cadenas empiezan y terminan con `"` en la misma línea.',
            '**سلسلة نصية غير مغلقة**. تبدأ السلاسل وتنتهي بـ `"` على السطر نفسه.',
        ],
    ];

    private const UI = [
        'generic' => [
            'Read the error message and the line it points to. Compare that line with the original example — the **Restore** button brings the lesson code back if you get stuck.',
            'Lisez le message d’erreur et la ligne indiquée. Comparez-la avec l’exemple d’origine — le bouton **Rétablir** remet le code de la leçon si vous êtes bloqué.',
            'Lee el mensaje de error y la línea que señala. Compárala con el ejemplo original; el botón **Restaurar** recupera el código de la lección si te atascas.',
            'اقرأ رسالة الخطأ والسطر الذي تشير إليه. قارنه بالمثال الأصلي — يعيد زر **الاستعادة** شيفرة الدرس إذا تعثّرت.',
        ],
        'noError' => [
            'No error right now 🎉 Run the sketch: if it behaves unexpectedly, watch the **serial monitor** and use the **debugger** (breakpoints and step) to follow it line by line.',
            'Aucune erreur pour l’instant 🎉 Lancez le croquis : s’il se comporte bizarrement, surveillez le **moniteur série** et utilisez le **débogueur** (points d’arrêt et pas-à-pas).',
            'Ahora mismo no hay errores 🎉 Ejecuta el sketch: si se comporta de forma inesperada, observa el **monitor serie** y usa el **depurador** (puntos de interrupción y paso a paso).',
            'لا يوجد خطأ حاليًا 🎉 شغّل البرنامج: إذا تصرّف بشكل غير متوقع، راقب **الشاشة التسلسلية** واستخدم **مصحّح الأخطاء** (نقاط التوقف والتنفيذ خطوة بخطوة).',
        ],
        'explainIntro' => [
            'Here is what this sketch does, step by step:',
            'Voici ce que fait ce croquis, étape par étape :',
            'Esto es lo que hace este sketch, paso a paso:',
            'إليك ما يفعله هذا البرنامج خطوة بخطوة:',
        ],
        'hintIntro' => ['Hint for the challenge:', 'Indice pour le défi :', 'Pista para el reto:', 'تلميح للتحدي:'],
        'offline' => [
            'I’m the **offline tutor**: I can explain the lesson code, decode errors and give challenge hints. For free-form questions, the platform owner can enable the Claude-powered tutor.',
            'Je suis le **tuteur hors ligne** : j’explique le code de la leçon, je décode les erreurs et je donne des indices. Pour des questions libres, l’administrateur peut activer le tuteur propulsé par Claude.',
            'Soy el **tutor sin conexión**: explico el código de la lección, descifro errores y doy pistas. Para preguntas libres, el administrador puede activar el tutor con Claude.',
            'أنا **المعلّم دون اتصال**: أشرح شيفرة الدرس وأفسّر الأخطاء وأقدّم تلميحات. للأسئلة الحرة يمكن لمسؤول المنصة تفعيل المعلّم المدعوم بـ Claude.',
        ],
    ];

    private const LOCALES = ['en' => 0, 'fr' => 1, 'es' => 2, 'ar' => 3];

    /** @param array<string, mixed> $lesson presenter detail */
    public function answer(string $mode, string $locale, array $lesson, string $error): string
    {
        $i = self::LOCALES[$locale] ?? 0;
        $strip = static fn (string $html) => trim(html_entity_decode(strip_tags($html), \ENT_QUOTES));

        if ('debug' === $mode || ('' !== $error && 'ask' === $mode)) {
            if ('' === trim($error)) {
                return self::UI['noError'][$i];
            }
            foreach (self::ERRORS as $pattern => $texts) {
                if (preg_match($pattern, $error)) {
                    return "`{$error}`\n\n".$texts[$i];
                }
            }

            return "`{$error}`\n\n".self::UI['generic'][$i];
        }

        if ('hint' === $mode && !empty($lesson['challenge']['hint'])) {
            return self::UI['hintIntro'][$i]."\n\n".$strip($lesson['challenge']['hint']);
        }

        $steps = array_map(static fn ($s, $n) => ($n + 1).'. '.$strip($s), $lesson['steps'] ?? [], array_keys($lesson['steps'] ?? []));
        $body = self::UI['explainIntro'][$i]."\n\n".implode("\n", $steps);

        return 'ask' === $mode ? self::UI['offline'][$i]."\n\n".$body : $body;
    }
}
