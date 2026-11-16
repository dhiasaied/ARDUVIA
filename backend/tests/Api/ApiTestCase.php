<?php

namespace App\Tests\Api;

use App\Service\LessonImporter;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/** Fresh SQLite schema + imported lesson catalogue for every test. */
abstract class ApiTestCase extends WebTestCase
{
    protected KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($em);
        $meta = $em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($meta);
        $tool->createSchema($meta);
        static::getContainer()->get(LessonImporter::class)->import();
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array<mixed>
     */
    protected function call(string $method, string $uri, ?array $body = null, int $expected = 200): array
    {
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : (string) json_encode($body));
        self::assertResponseStatusCodeSame($expected, (string) $this->client->getResponse()->getContent());

        return json_decode((string) $this->client->getResponse()->getContent(), true) ?? [];
    }

    protected function newLearner(): string
    {
        return $this->call('POST', '/api/learners', [], 201)['token'];
    }
}
