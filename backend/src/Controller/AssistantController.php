<?php

namespace App\Controller;

use App\Dto\AssistantInput;
use App\Entity\ActivityEvent;
use App\Repository\LearnerRepository;
use App\Repository\LessonRepository;
use App\Service\LearningAssistant;
use App\Service\LessonPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/assistant', name: 'api_assistant_')]
final class AssistantController extends AbstractController
{
    public function __construct(
        private readonly LearningAssistant $assistant,
        private readonly LessonRepository $lessons,
        private readonly LearnerRepository $learners,
        private readonly LessonPresenter $presenter,
        private readonly EntityManagerInterface $em,
        private readonly RateLimiterFactory $assistantLimiter,
    ) {
    }

    #[Route('/status', name: 'status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        return $this->json(['ai' => $this->assistant->isAiEnabled(), 'model' => $this->assistant->isAiEnabled() ? LearningAssistant::MODEL : null]);
    }

    #[Route('', name: 'ask', methods: ['POST'])]
    public function ask(#[MapRequestPayload] AssistantInput $input): JsonResponse
    {
        $learner = $this->learners->findOneByToken($input->token) ?? throw new NotFoundHttpException('Unknown learner.');
        $limit = $this->assistantLimiter->create($input->token)->consume();
        if (!$limit->isAccepted()) {
            throw new TooManyRequestsHttpException($limit->getRetryAfter()->getTimestamp() - time(), 'Too many questions, please wait a moment.');
        }
        $lesson = $this->lessons->findOneBySlug($input->lesson) ?? throw new NotFoundHttpException('Unknown lesson.');
        $result = $this->assistant->answer($input, $this->presenter->detail($lesson, $input->locale));

        $this->em->persist(new ActivityEvent($learner, ActivityEvent::ASSISTANT, $input->lesson, ['mode' => $input->mode, 'source' => $result['source']]));
        $this->em->flush();

        return $this->json($result + ['remaining' => $limit->getRemainingTokens()]);
    }
}
