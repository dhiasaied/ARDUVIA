<?php

namespace App\Entity;

use App\Repository\LessonRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: LessonRepository::class)]
#[ORM\Table(name: 'lesson')]
#[ORM\UniqueConstraint(name: 'uniq_lesson_slug', columns: ['slug'])]
class Lesson
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 40)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9-]+$/')]
    private string $slug;

    #[ORM\Column]
    #[Assert\Positive]
    private int $position;

    #[ORM\Column(length: 30)]
    private string $category = 'basics';

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\NotBlank]
    private string $code;

    /** @var Collection<int, LessonTranslation> */
    #[ORM\OneToMany(targetEntity: LessonTranslation::class, mappedBy: 'lesson', cascade: ['persist', 'remove'], orphanRemoval: true, indexBy: 'locale')]
    private Collection $translations;

    public function __construct(string $slug, int $position)
    {
        $this->slug = $slug;
        $this->position = $position;
        $this->translations = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getSlug(): string { return $this->slug; }
    public function getPosition(): int { return $this->position; }
    public function setPosition(int $position): static { $this->position = $position; return $this; }
    public function getCategory(): string { return $this->category; }
    public function setCategory(string $category): static { $this->category = $category; return $this; }
    public function getCode(): string { return $this->code; }
    public function setCode(string $code): static { $this->code = $code; return $this; }

    /** @return Collection<int, LessonTranslation> */
    public function getTranslations(): Collection { return $this->translations; }

    public function getTranslation(string $locale, string $fallback = 'en'): ?LessonTranslation
    {
        foreach ([$locale, $fallback] as $wanted) {
            foreach ($this->translations as $t) {
                if ($t->getLocale() === $wanted) {
                    return $t;
                }
            }
        }
        return $this->translations->first() ?: null;
    }

    public function addTranslation(LessonTranslation $translation): static
    {
        if (!$this->translations->contains($translation)) {
            $this->translations->add($translation);
            $translation->setLesson($this);
        }
        return $this;
    }
}
