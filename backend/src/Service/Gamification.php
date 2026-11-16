<?php

namespace App\Service;

use App\Entity\ActivityEvent;
use App\Entity\Learner;
use App\Repository\ActivityEventRepository;
use App\Repository\LessonProgressRepository;
use App\Repository\LessonRepository;

/**
 * Derives XP, levels, streaks, achievements and analytics from a learner's
 * activity log and lesson progress. Pure computation: nothing is stored here,
 * so the rules can evolve without migrations.
 */
final class Gamification
{
    public const XP_LESSON = 100;
    public const XP_CHALLENGE = 150;
    public const XP_RUN = 5;
    public const XP_RUNS_PER_DAY_CAP = 10;
    public const XP_DEBUG_FIX = 25;
    public const XP_ASSISTANT = 2;
    public const XP_ASSISTANT_PER_DAY_CAP = 5;

    private const SENSOR_LESSONS = ['light', 'sensor', 'heat', 'force'];

    /** Achievement id => human-independent rule description (labels live in the client). */
    public const ACHIEVEMENTS = [
        'first_run', 'first_lesson', 'five_lessons', 'all_lessons', 'first_challenge',
        'challenger', 'debugger', 'curious', 'streak_3', 'sensor_pro',
    ];

    public function __construct(
        private readonly ActivityEventRepository $events,
        private readonly LessonProgressRepository $progress,
        private readonly LessonRepository $lessons,
    ) {
    }

    /** XP needed to reach a level (level 1 starts at 0). */
    public static function levelThreshold(int $level): int
    {
        return (int) (50 * ($level - 1) * ($level + 2));
    }

    public static function levelFor(int $xp): int
    {
        $level = 1;
        while ($xp >= self::levelThreshold($level + 1)) {
            ++$level;
        }

        return $level;
    }

    /** @return array<string, mixed> */
    public function dashboard(Learner $learner, ?\DateTimeImmutable $now = null): array
    {
        $now ??= new \DateTimeImmutable();
        $total = $this->lessons->count([]);
        $events = $this->events->findForLearner($learner);

        // Merge completions (from progress) into one chronological timeline.
        $timeline = [];
        foreach ($this->progress->findForLearner($learner) as $p) {
            if ($p->getCompletedAt()) {
                $timeline[] = ['type' => 'complete', 'lesson' => $p->getLesson()->getSlug(), 'at' => $p->getCompletedAt()];
            }
        }
        foreach ($events as $e) {
            $timeline[] = ['type' => $e->getType(), 'lesson' => $e->getLessonSlug(), 'at' => $e->getCreatedAt()];
        }
        usort($timeline, static fn ($a, $b) => $a['at'] <=> $b['at']);

        $xp = 0;
        $completed = $challenges = $fixes = [];
        $runs = $questions = 0;
        $runsPerDay = $questionsPerDay = $activityPerDay = [];
        $unlocked = [];
        $days = [];

        foreach ($timeline as $item) {
            $day = $item['at']->format('Y-m-d');
            $days[$day] = true;
            $activityPerDay[$day] = ($activityPerDay[$day] ?? 0) + 1;
            switch ($item['type']) {
                case 'complete':
                    if (!isset($completed[$item['lesson']])) { $completed[$item['lesson']] = true; $xp += self::XP_LESSON; }
                    break;
                case ActivityEvent::CHALLENGE:
                    if (!isset($challenges[$item['lesson']])) { $challenges[$item['lesson']] = true; $xp += self::XP_CHALLENGE; }
                    break;
                case ActivityEvent::DEBUG_FIX:
                    if (!isset($fixes[$item['lesson']])) { $fixes[$item['lesson']] = true; $xp += self::XP_DEBUG_FIX; }
                    break;
                case ActivityEvent::RUN:
                    ++$runs;
                    $runsPerDay[$day] = ($runsPerDay[$day] ?? 0) + 1;
                    if ($runsPerDay[$day] <= self::XP_RUNS_PER_DAY_CAP) { $xp += self::XP_RUN; }
                    break;
                case ActivityEvent::ASSISTANT:
                    ++$questions;
                    $questionsPerDay[$day] = ($questionsPerDay[$day] ?? 0) + 1;
                    if ($questionsPerDay[$day] <= self::XP_ASSISTANT_PER_DAY_CAP) { $xp += self::XP_ASSISTANT; }
                    break;
            }

            $state = [
                'runs' => $runs, 'completed' => \count($completed), 'challenges' => \count($challenges),
                'fixes' => \count($fixes), 'questions' => $questions, 'bestStreak' => self::bestStreak(array_keys($days)),
                'sensors' => \count(array_intersect(self::SENSOR_LESSONS, array_keys($completed))), 'total' => $total,
            ];
            foreach ($this->evaluate($state) as $id) {
                $unlocked[$id] ??= $item['at'];
            }
        }

        $level = self::levelFor($xp);
        $dayKeys = array_keys($days);
        sort($dayKeys);

        $activity = [];
        for ($i = 13; $i >= 0; --$i) {
            $d = $now->modify("-{$i} days")->format('Y-m-d');
            $activity[] = ['date' => $d, 'count' => $activityPerDay[$d] ?? 0];
        }

        return [
            'xp' => $xp,
            'level' => $level,
            'levelXp' => self::levelThreshold($level),
            'nextLevelXp' => self::levelThreshold($level + 1),
            'streak' => self::currentStreak($dayKeys, $now),
            'bestStreak' => self::bestStreak($dayKeys),
            'completed' => array_keys($completed),
            'challenges' => array_keys($challenges),
            'runs' => $runs,
            'questions' => $questions,
            'fixes' => \count($fixes),
            'total' => $total,
            'achievements' => array_map(static fn ($id) => [
                'id' => $id,
                'unlocked' => isset($unlocked[$id]),
                'unlockedAt' => isset($unlocked[$id]) ? $unlocked[$id]->format(\DATE_ATOM) : null,
            ], self::ACHIEVEMENTS),
            'activity' => $activity,
        ];
    }

    /** @param array<string, int> $s @return string[] */
    private function evaluate(array $s): array
    {
        $ok = [];
        if ($s['runs'] >= 1) $ok[] = 'first_run';
        if ($s['completed'] >= 1) $ok[] = 'first_lesson';
        if ($s['completed'] >= 5) $ok[] = 'five_lessons';
        if ($s['total'] > 0 && $s['completed'] >= $s['total']) $ok[] = 'all_lessons';
        if ($s['challenges'] >= 1) $ok[] = 'first_challenge';
        if ($s['challenges'] >= 5) $ok[] = 'challenger';
        if ($s['fixes'] >= 1) $ok[] = 'debugger';
        if ($s['questions'] >= 1) $ok[] = 'curious';
        if ($s['bestStreak'] >= 3) $ok[] = 'streak_3';
        if ($s['sensors'] >= \count(self::SENSOR_LESSONS)) $ok[] = 'sensor_pro';

        return $ok;
    }

    /** @param string[] $sortedDays Y-m-d */
    public static function currentStreak(array $sortedDays, \DateTimeImmutable $now): int
    {
        $set = array_flip($sortedDays);
        $cursor = $now;
        if (!isset($set[$cursor->format('Y-m-d')])) {
            $cursor = $cursor->modify('-1 day'); // today not active yet: the streak is still alive
        }
        $streak = 0;
        while (isset($set[$cursor->format('Y-m-d')])) {
            ++$streak;
            $cursor = $cursor->modify('-1 day');
        }

        return $streak;
    }

    /** @param string[] $days Y-m-d (any order) */
    public static function bestStreak(array $days): int
    {
        sort($days);
        $best = $run = 0;
        $prev = null;
        foreach ($days as $d) {
            $run = ($prev && (new \DateTimeImmutable($prev))->modify('+1 day')->format('Y-m-d') === $d) ? $run + 1 : 1;
            $best = max($best, $run);
            $prev = $d;
        }

        return $best;
    }
}
