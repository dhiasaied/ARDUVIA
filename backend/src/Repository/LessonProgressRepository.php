<?php

namespace App\Repository;

use App\Entity\LessonProgress;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LessonProgress>
 */
class LessonProgressRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LessonProgress::class);
    }

    /** @return LessonProgress[] */
    public function findForLearner(\App\Entity\Learner $learner): array
    {
        return $this->createQueryBuilder('p')
            ->join('p.lesson', 'l')->addSelect('l')
            ->where('p.learner = :learner')->setParameter('learner', $learner)
            ->orderBy('l.position', 'ASC')
            ->getQuery()->getResult();
    }
}
