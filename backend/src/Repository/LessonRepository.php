<?php

namespace App\Repository;

use App\Entity\Lesson;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Lesson>
 */
class LessonRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Lesson::class);
    }

    /** @return Lesson[] */
    public function findAllOrdered(): array
    {
        return $this->createQueryBuilder('l')
            ->leftJoin('l.translations', 't')->addSelect('t')
            ->orderBy('l.position', 'ASC')
            ->getQuery()->getResult();
    }

    public function findOneBySlug(string $slug): ?Lesson
    {
        return $this->createQueryBuilder('l')
            ->leftJoin('l.translations', 't')->addSelect('t')
            ->where('l.slug = :slug')->setParameter('slug', $slug)
            ->getQuery()->getOneOrNullResult();
    }
}
