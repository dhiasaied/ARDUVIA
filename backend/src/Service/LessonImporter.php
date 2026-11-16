<?php

namespace App\Service;

use App\Entity\Lesson;
use App\Entity\LessonTranslation;
use App\Repository\LessonRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Loads (or refreshes) the lesson catalogue from data/lessons.json.
 * Idempotent: existing lessons are updated in place, keyed by slug.
 */
final class LessonImporter
{
    public const LOCALES = ['en', 'fr', 'es', 'ar'];
    public const DEFAULT_LOCALE = 'en';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly LessonRepository $lessons,
        private readonly ValidatorInterface $validator,
        #[Autowire('%kernel.project_dir%/data/lessons.json')]
        private readonly string $sourceFile,
    ) {
    }

    /** @return int number of lessons imported */
    public function import(?string $file = null): int
    {
        $file ??= $this->sourceFile;
        if (!is_file($file)) {
            throw new \RuntimeException(sprintf('Lesson file "%s" not found.', $file));
        }
        $rows = json_decode((string) file_get_contents($file), true, 512, \JSON_THROW_ON_ERROR);

        foreach ($rows as $row) {
            $lesson = $this->lessons->findOneBy(['slug' => $row['slug']]) ?? new Lesson($row['slug'], (int) $row['position']);
            $lesson->setPosition((int) $row['position'])
                ->setCategory($row['category'] ?? 'basics')
                ->setCode($row['code']);

            foreach (self::LOCALES as $locale) {
                if (!isset($row[$locale])) {
                    continue;
                }
                $data = $row[$locale];
                $translation = $lesson->getTranslations()->get($locale);
                if (!$translation instanceof LessonTranslation || $translation->getLocale() !== $locale) {
                    $translation = null;
                    foreach ($lesson->getTranslations() as $t) {
                        if ($t->getLocale() === $locale) {
                            $translation = $t;
                        }
                    }
                }
                if (!$translation) {
                    $translation = new LessonTranslation($locale);
                    $lesson->addTranslation($translation);
                }
                $translation->setTitle($data['title'])
                    ->setSubtitle($data['subtitle'] ?? '')
                    ->setHeading($data['heading'] ?? $data['title'])
                    ->setLede($data['lede'] ?? '')
                    ->setHint($data['hint'] ?? null)
                    ->setContent([
                        'features' => array_map(fn ($f) => ['icon' => $f[0], 'html' => $f[1]], $data['features'] ?? []),
                        'pinoutSub' => $data['pinoutSub'] ?? '',
                        'pinout' => array_map(fn ($p) => ['color' => $p[0], 'pin' => $p[1], 'to' => $p[2], 'role' => $p[3]], $data['pinout'] ?? []),
                        'steps' => $data['steps'] ?? [],
                        'specs' => array_map(fn ($s) => ['label' => $s[0], 'value' => $s[1]], $data['specs'] ?? []),
                        'parts' => array_map(fn ($p) => ['id' => $p[0], 'name' => $p[1], 'desc' => $p[2]], $data['parts'] ?? []),
                        'tags' => array_map(fn ($t) => ['part' => $t[0], 'label' => $t[1]], $data['tags'] ?? []),
                        'callouts' => array_map(fn ($c) => ['part' => $c[0], 'title' => $c[1], 'text' => $c[2]], $data['callouts'] ?? []),
                        'challenge' => $data['challenge'] ?? null,
                    ]);

                $errors = $this->validator->validate($translation);
                if (\count($errors) > 0) {
                    throw new \InvalidArgumentException(sprintf('Invalid lesson "%s" (%s): %s', $row['slug'], $locale, (string) $errors));
                }
            }

            $errors = $this->validator->validate($lesson);
            if (\count($errors) > 0) {
                throw new \InvalidArgumentException(sprintf('Invalid lesson "%s": %s', $row['slug'], (string) $errors));
            }
            $this->em->persist($lesson);
        }

        $this->em->flush();

        return \count($rows);
    }
}
