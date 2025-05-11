const { execSync } = require('child_process');
const { appendFileSync, existsSync } = require('fs');
const { join } = require('path');
const { parse, format } = require('date-fns');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
const pat = process.env.GITHUB_PAT;

// Command-line arguments interface
interface Arguments {
    repoDir: string;
    startDate: string;
    endDate: string;
    maxCommits: number;
    frequency: number;
    remote: string;
}

// Execute a shell command
const runCommand = (command: string, cwd: string): void => {
    try {
        execSync(command, { cwd, stdio: 'inherit' });
    } catch (error) {
        console.error(`Error running command: ${command}\n${(error as Error).message}`);
        process.exit(1);
    }
};

// Create a single commit with the specified date
const createCommit = (date: Date, repoDir: string, commitNumber: number): void => {
    const cFile = join(repoDir, 'program.c');
    const timestamp = format(date, 'yyyy-MM-dd HH:mm:ss');

    // Append a comment to program.c
    appendFileSync(cFile, `// Update ${commitNumber} on ${timestamp}\n`, 'utf-8');

    // Stage and commit with the specified date
    runCommand(`git add program.c`, repoDir);
    const commitMessage = `Update program.c on ${format(date, 'yyyy-MM-dd')}`;
    runCommand(
        `git commit -m "${commitMessage}" --date "${format(date, "yyyy-MM-dd HH:mm:ss")}"`,
        repoDir
    );
};

// Generate random commits between startDate and endDate
const generateCommits = (
    startDate: Date,
    endDate: Date,
    repoDir: string,
    maxCommitsPerDay: number,
    frequency: number,
    remote: string
): void => {
    let currentDate = startDate;
    let commitNumber = 1;

    while (currentDate <= endDate) {
        // Randomly decide if this day has commits
        if (Math.random() * 100 < frequency) {
            const numCommits = Math.floor(Math.random() * (maxCommitsPerDay + 1));
            for (let i = 0; i < numCommits; i++) {
                // Random time between 8 AM and 10 PM
                const hour = Math.floor(Math.random() * 15) + 8; // 8 to 22
                const minute = Math.floor(Math.random() * 60);
                const commitTime = new Date(currentDate);
                commitTime.setHours(hour, minute, 0, 0);
                createCommit(commitTime, repoDir, commitNumber);
                commitNumber++;
            }
        }

        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Push all commits to remote
    if (pat) {
        runCommand(`git remote set-url origin https://x-access-token:${pat}@${remote}`, repoDir);
        runCommand(`git push origin main`, repoDir);
    } else {
        console.error('Error: GITHUB_PAT not found in .env');
        process.exit(1);
    }
};

// Main function
const main = async (): Promise<void> => {
    const argv = yargs(hideBin(process.argv))
        .option('repoDir', {
            type: 'string',
            default: '.',
            description: 'Path to the Git repository directory',
        })
        .option('startDate', {
            type: 'string',
            default: '2012-02-20',
            description: 'Start date (YYYY-MM-DD)',
        })
        .option('endDate', {
            type: 'string',
            default: '2012-08-20',
            description: 'End date (YYYY-MM-DD)',
        })
        .option('maxCommits', {
            type: 'number',
            default: 40,
            description: 'Max commits per day',
        })
        .option('frequency', {
            type: 'number',
            default: 40,
            description: 'Percentage of days with commits (0-100)',
        })
        .option('remote', {
            type: 'string',
            demandOption: true,
            description: 'Remote repository URL (e.g., github.com/codebyMoh/c-language-school-project.git)',
        })
        .parseSync();

    const repoDir = join(process.cwd(), argv.repoDir);
    const startDate = parse(argv.startDate, 'yyyy-MM-dd', new Date());
    const endDate = parse(argv.endDate, 'yyyy-MM-dd', new Date());

    // Verify repository and program.c exist
    if (!existsSync(join(repoDir, '.git'))) {
        console.error('Error: Git repository not initialized in', repoDir);
        process.exit(1);
    }
    if (!existsSync(join(repoDir, 'program.c'))) {
        console.error('Error: program.c not found in', repoDir);
        process.exit(1);
    }

    // Generate commits and push
    generateCommits(
        startDate,
        endDate,
        repoDir,
        argv.maxCommits,
        argv.frequency,
        argv.remote
    );
};

// Run the script
main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});