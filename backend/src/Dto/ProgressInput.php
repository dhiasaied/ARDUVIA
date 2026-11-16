<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class ProgressInput
{
    public function __construct(
        #[Assert\NotNull]
        #[Assert\Type('bool')]
        public readonly bool $completed = true,
    ) {
    }
}
