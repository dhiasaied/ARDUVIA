<?php

namespace App\Controller;

use App\Repository\LessonRepository;
use App\Service\LessonImporter;
use App\Service\LessonPresenter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api', name: 'api_')]
final class LessonController extends AbstractController
{
    public function __construct(
        private readonly LessonRepository $lessons,
        private readonly LessonPresenter $presenter,
    ) {
    }

    #[Route('/health', name: 'health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        return $this->json(['status' => 'ok', 'lessons' => $this->lessons->count([])]);
    }

    #[Route('/locales', name: 'locales', methods: ['GET'])]
    public function locales(): JsonResponse
    {
        return $this->json([
            ['code' => 'en', 'name' => 'English', 'dir' => 'ltr'],
            ['code' => 'fr', 'name' => 'Français', 'dir' => 'ltr'],
            ['code' => 'es', 'name' => 'Español', 'dir' => 'ltr'],
            ['code' => 'ar', 'name' => 'العربية', 'dir' => 'rtl'],
        ]);
    }

    #[Route('/lessons', name: 'lessons', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $locale = $this->locale($request);
        $data = array_map(fn ($l) => $this->presenter->summary($l, $locale), $this->lessons->findAllOrdered());

        return $this->json($data, headers: ['Cache-Control' => 'public, max-age=60']);
    }

    #[Route('/lessons/{slug}', name: 'lesson', requirements: ['slug' => '[a-z0-9-]+'], methods: ['GET'])]
    public function show(string $slug, Request $request): JsonResponse
    {
        $lesson = $this->lessons->findOneBySlug($slug) ?? throw new NotFoundHttpException(sprintf('Lesson "%s" not found.', $slug));

        return $this->json($this->presenter->detail($lesson, $this->locale($request)), headers: ['Cache-Control' => 'public, max-age=60']);
    }

    private function locale(Request $request): string
    {
        $locale = (string) $request->query->get('locale', LessonImporter::DEFAULT_LOCALE);

        return \in_array($locale, LessonImporter::LOCALES, true) ? $locale : LessonImporter::DEFAULT_LOCALE;
    }
}
