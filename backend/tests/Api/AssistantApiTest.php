<?php

namespace App\Tests\Api;

final class AssistantApiTest extends ApiTestCase
{
    public function testOfflineTutorExplainsCompilerErrorsInTheLearnersLanguage(): void
    {
        $token = $this->newLearner();
        self::assertFalse($this->call('GET', '/api/assistant/status')['ai']);

        $answer = $this->call('POST', '/api/assistant', [
            'token' => $token, 'lesson' => 'blink', 'locale' => 'es', 'mode' => 'debug',
            'error' => "expected ';' before 'delay'", 'code' => 'void setup(){}',
        ]);
        self::assertSame('local', $answer['source']);
        self::assertStringContainsString('punto y coma', $answer['answer']);

        $hint = $this->call('POST', '/api/assistant', ['token' => $token, 'lesson' => 'blink', 'locale' => 'fr', 'mode' => 'hint']);
        self::assertStringContainsString('delay(500)', $hint['answer']);

        self::assertSame(2, $this->call('GET', "/api/learners/{$token}/dashboard")['questions']);
    }

    public function testAssistantInputIsValidated(): void
    {
        $token = $this->newLearner();
        $this->call('POST', '/api/assistant', ['token' => $token, 'lesson' => 'blink', 'mode' => 'jailbreak'], 422);
        $this->call('POST', '/api/assistant', ['token' => $token, 'lesson' => 'blink', 'question' => str_repeat('x', 700)], 422);
        $this->call('POST', '/api/assistant', ['token' => 'not-a-uuid', 'lesson' => 'blink'], 422);
    }
}
