<?php

namespace App\Entity;

use App\Repository\LearnerRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * An anonymous learner identified by an opaque token stored in the browser.
 */
#[ORM\Entity(repositoryClass: LearnerRepository::class)]
#[ORM\Table(name: 'learner')]
#[ORM\UniqueConstraint(name: 'uniq_learner_token', columns: ['token'])]
class Learner
{
    public const DEFAULT_SETTINGS = [
        'labels' => true,
        'flow' => true,
        'grid' => true,
        'autoRotate' => false,
        'sound' => true,
        'reducedMotion' => false,
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 36)]
    private string $token;

    #[ORM\Column(length: 8)]
    private string $locale = 'en';

    /** @var array<string, bool> */
    #[ORM\Column(type: Types::JSON)]
    private array $settings = self::DEFAULT_SETTINGS;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $lastSeenAt;

    /** @var Collection<int, LessonProgress> */
    #[ORM\OneToMany(targetEntity: LessonProgress::class, mappedBy: 'learner', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $progress;

    public function __construct()
    {
        $this->token = Uuid::v4()->toRfc4122();
        $this->createdAt = new \DateTimeImmutable();
        $this->lastSeenAt = $this->createdAt;
        $this->progress = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getToken(): string { return $this->token; }
    public function getLocale(): string { return $this->locale; }
    public function setLocale(string $locale): static { $this->locale = $locale; return $this; }
    /** @return array<string, bool> */
    public function getSettings(): array { return $this->settings + self::DEFAULT_SETTINGS; }
    /** @param array<string, bool> $settings */
    public function setSettings(array $settings): static
    {
        $this->settings = array_intersect_key($settings + $this->getSettings(), self::DEFAULT_SETTINGS);
        return $this;
    }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getLastSeenAt(): \DateTimeImmutable { return $this->lastSeenAt; }
    public function touch(): static { $this->lastSeenAt = new \DateTimeImmutable(); return $this; }

    /** @return Collection<int, LessonProgress> */
    public function getProgress(): Collection { return $this->progress; }
    public function addProgress(LessonProgress $p): static
    {
        if (!$this->progress->contains($p)) {
            $this->progress->add($p);
        }
        return $this;
    }
    public function clearProgress(): static { $this->progress->clear(); return $this; }
}
