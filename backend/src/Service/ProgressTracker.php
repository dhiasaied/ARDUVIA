<?php

namespace App\Service;

use App\Entity\Learner;
use App\Entity\Lesson;
use App\Entity\LessonProgress;
use App\Repository\LessonProgressRepository;
use App\Repository\LessonRepository;
use Doctrine\ORM\EntityManagerInterface;

final class ProgressTracker
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly LessonProgressRepository $progress,
        private readonly LessonRepository $lessons,
    ) {
    }

    public function record(Learner $learner, Lesson $lesson, bool $completed): LessonProgress
    {
        $entry = $this->progress->findOneBy(['learner' => $learner, 'lesson' => $lesson]);
        if (!$entry) {
            $entry = new LessonProgress($learner, $lesson);
            $learner->addProgress($entry);
            $this->em->persist($entry);
        }
        $entry->registerRun();
        if ($completed) {
            $entry->complete();
        }
        $learner->touch();
        $this->em->flush();

        return $entry;
    }

    public function reset(Learner $learner): void
    {
        foreach ($this->progress->findForLearner($learner) as $entry) {
            $this->em->remove($entry);
        }
        $learner->clearProgress()->touch();
        $this->em->flush();
    }

    /** @return array{completed: string[], total: int, count: int, lessons: array<int, array<string, mixed>>} */
    public function snapshot(Learner $learner): array
    {
        $entries = $this->progress->findForLearner($learner);
        $completed = [];
        $lessons = [];
        foreach ($entries as $e) {
            if ($e->isCompleted()) {
                $completed[] = $e->getLesson()->getSlug();
            }
            $lessons[] = [
                'slug' => $e->getLesson()->getSlug(),
                'runs' => $e->getRuns(),
                'completedAt' => $e->getCompletedAt()?->format(\DATE_ATOM),
            ];
        }

        return [
            'completed' => $completed,
            'count' => \count($completed),
            'total' => $this->lessons->count([]),
            'lessons' => $lessons,
        ];
    }
}
