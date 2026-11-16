<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261115205815 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE learner (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, token VARCHAR(36) NOT NULL, locale VARCHAR(8) NOT NULL, settings CLOB NOT NULL, created_at DATETIME NOT NULL, last_seen_at DATETIME NOT NULL)');
        $this->addSql('CREATE UNIQUE INDEX uniq_learner_token ON learner (token)');
        $this->addSql('CREATE TABLE lesson (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, slug VARCHAR(40) NOT NULL, position INTEGER NOT NULL, category VARCHAR(30) NOT NULL, code CLOB NOT NULL)');
        $this->addSql('CREATE UNIQUE INDEX uniq_lesson_slug ON lesson (slug)');
        $this->addSql('CREATE TABLE lesson_progress (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, runs INTEGER NOT NULL, completed_at DATETIME DEFAULT NULL, learner_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, CONSTRAINT FK_6A46B85F6209CB66 FOREIGN KEY (learner_id) REFERENCES learner (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_6A46B85FCDF80196 FOREIGN KEY (lesson_id) REFERENCES lesson (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE UNIQUE INDEX uniq_learner_lesson ON lesson_progress (learner_id, lesson_id)');
        $this->addSql('CREATE INDEX IDX_6A46B85F6209CB66 ON lesson_progress (learner_id)');
        $this->addSql('CREATE INDEX IDX_6A46B85FCDF80196 ON lesson_progress (lesson_id)');
        $this->addSql('CREATE TABLE lesson_translation (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, locale VARCHAR(8) NOT NULL, title VARCHAR(120) NOT NULL, subtitle VARCHAR(160) NOT NULL, heading VARCHAR(160) NOT NULL, lede CLOB NOT NULL, hint VARCHAR(160) DEFAULT NULL, content CLOB NOT NULL, lesson_id INTEGER NOT NULL, CONSTRAINT FK_45B0AE64CDF80196 FOREIGN KEY (lesson_id) REFERENCES lesson (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE UNIQUE INDEX uniq_lesson_locale ON lesson_translation (lesson_id, locale)');
        $this->addSql('CREATE INDEX IDX_45B0AE64CDF80196 ON lesson_translation (lesson_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE learner');
        $this->addSql('DROP TABLE lesson');
        $this->addSql('DROP TABLE lesson_progress');
        $this->addSql('DROP TABLE lesson_translation');
    }
}
