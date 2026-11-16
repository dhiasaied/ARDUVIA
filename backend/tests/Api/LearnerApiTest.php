<?php

namespace App\Tests\Api;

use App\Service\Gamification;

final class LearnerApiTest extends ApiTestCase
{
    public function testSettingsAreValidated(): void
    {
        $token = $this->newLearner();
        $profile = $this->call('PATCH', "/api/learners/{$token}/settings", ['locale' => 'ar', 'sound' => false]);
        self::assertSame('ar', $profile['locale']);
        self::assertFalse($profile['settings']['sound']);

        $error = $this->call('PATCH', "/api/learners/{$token}/settings", ['locale' => 'de'], 422);
        self::assertSame('locale', $error['violations'][0]['field']);
    }

    public function testEventsDriveXpAndAchievements(): void
    {
        $token = $this->newLearner();
        $dash = $this->call('POST', "/api/learners/{$token}/events", ['type' => 'run', 'lesson' => 'blink'], 201);
        self::assertSame(Gamification::XP_RUN, $dash['xp']);
        self::assertTrue($this->achievement($dash, 'first_run'));
        self::assertSame(1, $dash['streak']);

        $this->call('PUT', "/api/learners/{$token}/progress/blink", ['completed' => true]);
        // A challenge only counts once per lesson.
        $this->call('POST', "/api/learners/{$token}/events", ['type' => 'challenge', 'lesson' => 'blink'], 201);
        $dash = $this->call('POST', "/api/learners/{$token}/events", ['type' => 'challenge', 'lesson' => 'blink'], 201);

        self::assertSame(Gamification::XP_RUN + Gamification::XP_LESSON + Gamification::XP_CHALLENGE, $dash['xp']);
        self::assertSame(['blink'], $dash['challenges']);
        self::assertTrue($this->achievement($dash, 'first_challenge'));
        self::assertFalse($this->achievement($dash, 'five_lessons'));
        self::assertCount(14, $dash['activity']);
    }

    public function testInvalidEventsAreRejected(): void
    {
        $token = $this->newLearner();
        $this->call('POST', "/api/learners/{$token}/events", ['type' => 'assistant', 'lesson' => 'blink'], 422);
        $this->call('POST', "/api/learners/{$token}/events", ['type' => 'run', 'lesson' => 'nope'], 404);
    }

    public function testResetClearsProgressAndActivity(): void
    {
        $token = $this->newLearner();
        $this->call('POST', "/api/learners/{$token}/events", ['type' => 'run', 'lesson' => 'blink'], 201);
        $this->call('DELETE', "/api/learners/{$token}/progress");
        self::assertSame(0, $this->call('GET', "/api/learners/{$token}/dashboard")['xp']);
    }

    /** @param array<string, mixed> $dash */
    private function achievement(array $dash, string $id): bool
    {
        foreach ($dash['achievements'] as $a) {
            if ($a['id'] === $id) {
                return $a['unlocked'];
            }
        }
        self::fail("Unknown achievement {$id}");
    }
}
