<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Validator\Exception\ValidationFailedException;

/**
 * Renders every error under /api as a small JSON problem document.
 */
final class ApiExceptionSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::EXCEPTION => ['onException', 0]];
    }

    public function onException(ExceptionEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/api')) {
            return;
        }

        $e = $event->getThrowable();
        $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;
        $body = [
            'status' => $status,
            'error' => $status >= 500 ? 'Internal server error' : $e->getMessage(),
        ];

        $previous = $e->getPrevious();
        if ($previous instanceof ValidationFailedException) {
            $body['error'] = 'Validation failed';
            $body['violations'] = [];
            foreach ($previous->getViolations() as $v) {
                $body['violations'][] = ['field' => $v->getPropertyPath(), 'message' => $v->getMessage()];
            }
        }

        $event->setResponse(new JsonResponse($body, $status));
    }
}
