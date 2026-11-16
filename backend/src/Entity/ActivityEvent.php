<?php

namespace App\Entity;

use App\Repository\ActivityEventRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * One learning action (a sketch run, an error, a fixed bug, a solved challenge,
 * a question to the tutor). Gamification and analytics are derived from these.
 */
#[ORM\Entity(repositoryClass: ActivityEventRepository::class)]
#[ORM\Table(name: 'activity_event')]
#[ORM\Index(name: 'idx_activity_learner_time', columns: ['learner_id', 'created_at'])]
class ActivityEvent
{
    public const RUN = 'run';
    public const ERROR = 'error';
    public const DEBUG_FIX = 'debug_fix';
    public const CHALLENGE = 'challenge';
    public const ASSISTANT = 'assistant';
    /** Types a client may record directly (assistant is logged server-side). */
    public const CLIENT_TYPES = [self::RUN, self::ERROR, self::DEBUG_FIX, self::CHALLENGE];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Learner $learner;

    #[ORM\Column(length: 20)]
    private string $type;

    #[ORM\Column(length: 40, nullable: true)]
    private ?string $lessonSlug;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON)]
    private array $meta;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @param array<string, mixed> $meta */
    public function __construct(Learner $learner, string $type, ?string $lessonSlug = null, array $meta = [], ?\DateTimeImmutable $at = null)
    {
        $this->learner = $learner;
        $this->type = $type;
        $this->lessonSlug = $lessonSlug;
        $this->meta = $meta;
        $this->createdAt = $at ?? new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getLearner(): Learner { return $this->learner; }
    public function getType(): string { return $this->type; }
    public function getLessonSlug(): ?string { return $this->lessonSlug; }
    /** @return array<string, mixed> */
    public function getMeta(): array { return $this->meta; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
