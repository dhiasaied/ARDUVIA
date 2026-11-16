<?php

namespace App\Service;

use App\Entity\Lesson;

/**
 * Turns Lesson entities into the JSON shapes consumed by the Angular client.
 */
final class LessonPresenter
{
    /** @return array<string, mixed> */
    public function summary(Lesson $lesson, string $locale): array
    {
        $t = $lesson->getTranslation($locale);

        return [
            'slug' => $lesson->getSlug(),
            'position' => $lesson->getPosition(),
            'category' => $lesson->getCategory(),
            'title' => $t?->getTitle(),
            'subtitle' => $t?->getSubtitle(),
        ];
    }

    /** @return array<string, mixed> */
    public function detail(Lesson $lesson, string $locale): array
    {
        $t = $lesson->getTranslation($locale);
        $content = $t?->getContent() ?? [];

        return $this->summary($lesson, $locale) + [
            'locale' => $t?->getLocale(),
            'heading' => $t?->getHeading(),
            'lede' => $t?->getLede(),
            'hint' => $t?->getHint(),
            'code' => $lesson->getCode(),
            'features' => $content['features'] ?? [],
            'pinoutSub' => $content['pinoutSub'] ?? '',
            'pinout' => $content['pinout'] ?? [],
            'steps' => $content['steps'] ?? [],
            'specs' => $content['specs'] ?? [],
            'parts' => $content['parts'] ?? [],
            'tags' => $content['tags'] ?? [],
            'callouts' => $content['callouts'] ?? [],
            'challenge' => $content['challenge'] ?? null,
        ];
    }
}
