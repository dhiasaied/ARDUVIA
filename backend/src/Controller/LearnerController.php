<?php

namespace App\Controller;

use App\Dto\EventInput;
use App\Dto\ProgressInput;
use App\Entity\ActivityEvent;
use App\Repository\ActivityEventRepository;
use App\Service\Gamification;
use App\Dto\SettingsInput;
use App\Entity\Learner;
use App\Repository\LearnerRepository;
use App\Repository\LessonRepository;
use App\Service\ProgressTracker;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Anonymous learner profile: settings + lesson progress, addressed by token.
 */
#[Route('/api/learners', name: 'api_learner_')]
final class LearnerController extends AbstractController
{
    private const TOKEN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    public function __construct(
        private readonly LearnerRepository $learners,
        private readonly LessonRepository $lessons,
        private readonly ProgressTracker $tracker,
        private readonly EntityManagerInterface $em,
        private readonly ActivityEventRepository $events,
        private readonly Gamification $gamification,
    ) {
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(): JsonResponse
    {
        $learner = new Learner();
        $this->em->persist($learner);
        $this->em->flush();

        return $this->json($this->profile($learner), Response::HTTP_CREATED);
    }

    #[Route('/{token}', name: 'show', requirements: ['token' => self::TOKEN], methods: ['GET'])]
    public function show(string $token): JsonResponse
    {
        $learner = $this->find($token);
        $learner->touch();
        $this->em->flush();

        return $this->json($this->profile($learner));
    }

    #[Route('/{token}/settings', name: 'settings', requirements: ['token' => self::TOKEN], methods: ['PATCH'])]
    public function updateSettings(string $token, #[MapRequestPayload] SettingsInput $input): JsonResponse
    {
        $learner = $this->find($token);
        $learner->setSettings($input->toggles());
        if ($input->locale) {
            $learner->setLocale($input->locale);
        }
        $learner->touch();
        $this->em->flush();

        return $this->json($this->profile($learner));
    }

    #[Route('/{token}/progress', name: 'progress', requirements: ['token' => self::TOKEN], methods: ['GET'])]
    public function progress(string $token): JsonResponse
    {
        return $this->json($this->tracker->snapshot($this->find($token)));
    }

    #[Route('/{token}/progress/{slug}', name: 'progress_record', requirements: ['token' => self::TOKEN, 'slug' => '[a-z0-9-]+'], methods: ['PUT'])]
    public function record(string $token, string $slug, #[MapRequestPayload] ProgressInput $input): JsonResponse
    {
        $learner = $this->find($token);
        $lesson = $this->lessons->findOneBy(['slug' => $slug]) ?? throw new NotFoundHttpException(sprintf('Lesson "%s" not found.', $slug));
        $this->tracker->record($learner, $lesson, $input->completed);

        return $this->json($this->tracker->snapshot($learner));
    }

    #[Route('/{token}/progress', name: 'progress_reset', requirements: ['token' => self::TOKEN], methods: ['DELETE'])]
    public function reset(string $token): JsonResponse
    {
        $learner = $this->find($token);
        $this->tracker->reset($learner);
        $this->events->deleteForLearner($learner);

        return $this->json($this->tracker->snapshot($learner));
    }

    /** XP, level, streak, achievements and 14-day activity. */
    #[Route('/{token}/dashboard', name: 'dashboard', requirements: ['token' => self::TOKEN], methods: ['GET'])]
    public function dashboard(string $token): JsonResponse
    {
        return $this->json($this->gamification->dashboard($this->find($token)));
    }

    /** Record a learning event (run, error, fixed bug, solved challenge); returns the updated dashboard. */
    #[Route('/{token}/events', name: 'event', requirements: ['token' => self::TOKEN], methods: ['POST'])]
    public function event(string $token, #[MapRequestPayload] EventInput $input): JsonResponse
    {
        $learner = $this->find($token);
        if (!$this->lessons->findOneBy(['slug' => $input->lesson])) {
            throw new NotFoundHttpException(sprintf('Lesson "%s" not found.', $input->lesson));
        }
        // Challenges and bug fixes count once per lesson.
        $once = \in_array($input->type, [ActivityEvent::CHALLENGE, ActivityEvent::DEBUG_FIX], true);
        if (!$once || !$this->events->has($learner, $input->type, $input->lesson)) {
            $this->em->persist(new ActivityEvent($learner, $input->type, $input->lesson));
        }
        $learner->touch();
        $this->em->flush();

        return $this->json($this->gamification->dashboard($learner), Response::HTTP_CREATED);
    }

    private function find(string $token): Learner
    {
        return $this->learners->findOneByToken($token) ?? throw new NotFoundHttpException('Unknown learner.');
    }

    /** @return array<string, mixed> */
    private function profile(Learner $learner): array
    {
        return [
            'token' => $learner->getToken(),
            'locale' => $learner->getLocale(),
            'settings' => $learner->getSettings(),
            'createdAt' => $learner->getCreatedAt()->format(\DATE_ATOM),
            'progress' => $this->tracker->snapshot($learner),
        ];
    }
}
