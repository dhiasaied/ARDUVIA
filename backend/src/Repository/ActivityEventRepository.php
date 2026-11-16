<?php

namespace App\Repository;

use App\Entity\ActivityEvent;
use App\Entity\Learner;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ActivityEvent>
 */
class ActivityEventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ActivityEvent::class);
    }

    /** @return ActivityEvent[] chronological */
    public function findForLearner(Learner $learner): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.learner = :l')->setParameter('l', $learner)
            ->orderBy('e.createdAt', 'ASC')->addOrderBy('e.id', 'ASC')
            ->getQuery()->getResult();
    }

    public function has(Learner $learner, string $type, string $lessonSlug): bool
    {
        return null !== $this->findOneBy(['learner' => $learner, 'type' => $type, 'lessonSlug' => $lessonSlug]);
    }

    public function deleteForLearner(Learner $learner): void
    {
        $this->createQueryBuilder('e')->delete()
            ->where('e.learner = :l')->setParameter('l', $learner)
            ->getQuery()->execute();
    }
}
