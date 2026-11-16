<?php

namespace App\Command;

use App\Service\LessonImporter;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:lessons:import', description: 'Import or refresh the lesson catalogue from data/lessons.json')]
final class ImportLessonsCommand extends Command
{
    public function __construct(private readonly LessonImporter $importer)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('file', InputArgument::OPTIONAL, 'Path to a lessons JSON file');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $count = $this->importer->import($input->getArgument('file'));
        $io->success(sprintf('%d lessons imported.', $count));

        return Command::SUCCESS;
    }
}
