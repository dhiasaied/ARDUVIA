<?php

namespace App\Entity;

use App\Repository\LessonProgressRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LessonProgressRepository::class)]
#[ORM\Table(name: 'lesson_progress')]
#[ORM\UniqueConstraint(name: 'uniq_learner_lesson', columns: ['learner_id', 'lesson_id'])]
class LessonProgress
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'progress')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Learner $learner;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Lesson $lesson;

    #[ORM\Column]
    private int $runs = 0;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $completedAt = null;

    public function __construct(Learner $learner, Lesson $lesson)
    {
        $this->learner = $learner;
        $this->lesson = $lesson;
    }

    public function getId(): ?int { return $this->id; }
    public function getLearner(): Learner { return $this->learner; }
    public function getLesson(): Lesson { return $this->lesson; }
    public function getRuns(): int { return $this->runs; }
    public function registerRun(): static { ++$this->runs; return $this; }
    public function getCompletedAt(): ?\DateTimeImmutable { return $this->completedAt; }
    public function isCompleted(): bool { return null !== $this->completedAt; }
    public function complete(): static
    {
        $this->completedAt ??= new \DateTimeImmutable();
        return $this;
    }
}
