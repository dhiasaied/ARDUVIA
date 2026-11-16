<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A question to the learning assistant. Code, errors and serial output are
 * learner-provided data and are always treated as untrusted content.
 */
final class AssistantInput
{
    public const MODES = ['explain', 'debug', 'hint', 'ask'];

    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public readonly string $token = '',
        #[Assert\NotBlank]
        #[Assert\Regex('/^[a-z0-9-]{1,40}$/')]
        public readonly string $lesson = '',
        #[Assert\Choice(choices: ['en', 'fr', 'es', 'ar'])]
        public readonly string $locale = 'en',
        #[Assert\Choice(choices: self::MODES)]
        public readonly string $mode = 'ask',
        #[Assert\Length(max: 600)]
        public readonly string $question = '',
        #[Assert\Length(max: 8000)]
        public readonly string $code = '',
        #[Assert\Length(max: 600)]
        public readonly string $error = '',
        #[Assert\Length(max: 2000)]
        public readonly string $serial = '',
    ) {
    }
}
