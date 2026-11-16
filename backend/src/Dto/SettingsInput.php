<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * PATCH payload for learner preferences. Every field is optional; only the
 * provided ones are applied.
 */
final class SettingsInput
{
    public function __construct(
        #[Assert\Choice(choices: ['en', 'fr', 'es', 'ar'], message: 'Unsupported locale.')]
        public readonly ?string $locale = null,
        #[Assert\Type('bool')]
        public readonly ?bool $labels = null,
        #[Assert\Type('bool')]
        public readonly ?bool $flow = null,
        #[Assert\Type('bool')]
        public readonly ?bool $grid = null,
        #[Assert\Type('bool')]
        public readonly ?bool $autoRotate = null,
        #[Assert\Type('bool')]
        public readonly ?bool $sound = null,
        #[Assert\Type('bool')]
        public readonly ?bool $reducedMotion = null,
    ) {
    }

    /** @return array<string, bool> */
    public function toggles(): array
    {
        return array_filter([
            'labels' => $this->labels,
            'flow' => $this->flow,
            'grid' => $this->grid,
            'autoRotate' => $this->autoRotate,
            'sound' => $this->sound,
            'reducedMotion' => $this->reducedMotion,
        ], static fn ($v) => null !== $v);
    }
}
