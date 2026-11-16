<?php

namespace App\Tests\Api;

final class LessonApiTest extends ApiTestCase
{
    public function testCatalogueIsOrderedAndLocalised(): void
    {
        $en = $this->call('GET', '/api/lessons?locale=en');
        self::assertCount(16, $en);
        self::assertSame('board', $en[0]['slug']);
        self::assertSame('Blink an LED', $en[1]['title']);

        $ar = $this->call('GET', '/api/lessons?locale=ar');
        self::assertSame('اجعل مصباح LED يومض', $ar[1]['title']);
    }

    public function testLessonDetailHasChallengeInEveryLanguage(): void
    {
        foreach (['en', 'fr', 'es', 'ar'] as $locale) {
            $detail = $this->call('GET', "/api/lessons/blink?locale={$locale}");
            self::assertSame($locale, $detail['locale']);
            self::assertNotEmpty($detail['challenge']['title']);
            self::assertNotEmpty($detail['code']);
        }
    }

    public function testUnknownLocaleFallsBackToEnglishAndUnknownLessonIs404(): void
    {
        self::assertSame('en', $this->call('GET', '/api/lessons/blink?locale=xx')['locale']);
        $error = $this->call('GET', '/api/lessons/nope', expected: 404);
        self::assertSame(404, $error['status']);
    }
}
