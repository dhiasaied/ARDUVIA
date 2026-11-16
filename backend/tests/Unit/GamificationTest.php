<?php

namespace App\Tests\Unit;

use App\Service\Gamification;
use PHPUnit\Framework\TestCase;

final class GamificationTest extends TestCase
{
    public function testLevelsGrowWithXp(): void
    {
        self::assertSame(0, Gamification::levelThreshold(1));
        self::assertSame(1, Gamification::levelFor(0));
        self::assertSame(2, Gamification::levelFor(Gamification::levelThreshold(2)));
        self::assertSame(1, Gamification::levelFor(Gamification::levelThreshold(2) - 1));
    }

    public function testStreaks(): void
    {
        $now = new \DateTimeImmutable('2026-03-10 12:00');
        $days = ['2026-03-07', '2026-03-08', '2026-03-09'];
        self::assertSame(3, Gamification::currentStreak($days, $now), 'yesterday still counts');
        self::assertSame(4, Gamification::currentStreak([...$days, '2026-03-10'], $now));
        self::assertSame(0, Gamification::currentStreak(['2026-03-01'], $now));
        self::assertSame(3, Gamification::bestStreak(['2026-01-01', '2026-02-01', '2026-02-02', '2026-02-03']));
    }
}
