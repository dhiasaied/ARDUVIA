<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Localised copy of a lesson. Structured blocks (features, pin table, steps,
 * specs, parts, tags, callouts) are stored as JSON documents.
 */
#[ORM\Entity]
#[ORM\Table(name: 'lesson_translation')]
#[ORM\UniqueConstraint(name: 'uniq_lesson_locale', columns: ['lesson_id', 'locale'])]
class LessonTranslation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'translations')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Lesson $lesson = null;

    #[ORM\Column(length: 8)]
    #[Assert\Choice(choices: ['en', 'fr', 'es', 'ar'])]
    private string $locale;

    #[ORM\Column(length: 120)]
    #[Assert\NotBlank]
    private string $title;

    #[ORM\Column(length: 160)]
    private string $subtitle = '';

    #[ORM\Column(length: 160)]
    private string $heading = '';

    #[ORM\Column(type: Types::TEXT)]
    private string $lede = '';

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $hint = null;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON)]
    private array $content = [];

    public function __construct(string $locale)
    {
        $this->locale = $locale;
    }

    public function getId(): ?int { return $this->id; }
    public function getLesson(): ?Lesson { return $this->lesson; }
    public function setLesson(Lesson $lesson): static { $this->lesson = $lesson; return $this; }
    public function getLocale(): string { return $this->locale; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getSubtitle(): string { return $this->subtitle; }
    public function setSubtitle(string $subtitle): static { $this->subtitle = $subtitle; return $this; }
    public function getHeading(): string { return $this->heading; }
    public function setHeading(string $heading): static { $this->heading = $heading; return $this; }
    public function getLede(): string { return $this->lede; }
    public function setLede(string $lede): static { $this->lede = $lede; return $this; }
    public function getHint(): ?string { return $this->hint; }
    public function setHint(?string $hint): static { $this->hint = $hint; return $this; }
    /** @return array<string, mixed> */
    public function getContent(): array { return $this->content; }
    /** @param array<string, mixed> $content */
    public function setContent(array $content): static { $this->content = $content; return $this; }
}
