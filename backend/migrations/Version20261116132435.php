<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261116132435 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE activity_event (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, type VARCHAR(20) NOT NULL, lesson_slug VARCHAR(40) DEFAULT NULL, meta CLOB NOT NULL, created_at DATETIME NOT NULL, learner_id INTEGER NOT NULL, CONSTRAINT FK_25AC3C146209CB66 FOREIGN KEY (learner_id) REFERENCES learner (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX idx_activity_learner_time ON activity_event (learner_id, created_at)');
        $this->addSql('CREATE INDEX IDX_25AC3C146209CB66 ON activity_event (learner_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE activity_event');
    }
}
