<?php

namespace App\Dto;

use App\Entity\ActivityEvent;
use Symfony\Component\Validator\Constraints as Assert;

final class EventInput
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Choice(choices: ActivityEvent::CLIENT_TYPES, message: 'Unsupported event type.')]
        public readonly string $type = '',
        #[Assert\NotBlank]
        #[Assert\Regex('/^[a-z0-9-]{1,40}$/')]
        public readonly string $lesson = '',
    ) {
    }
}
