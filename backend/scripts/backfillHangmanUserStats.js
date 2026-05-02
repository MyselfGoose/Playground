import 'dotenv/config';
import mongoose from 'mongoose';
import { DEFAULT_MONGO_URI } from '../src/config/devDefaults.js';
import { UserStats } from '../src/models/UserStats.js';

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim() || DEFAULT_MONGO_URI;
  await mongoose.connect(mongoUri);

  const result = await UserStats.updateMany(
    {},
    {
      $set: {
        hangman_totalGames: 0,
        hangman_totalWins: 0,
        hangman_winRate: 0,
        hangman_correctGuesses: 0,
        hangman_wrongGuesses: 0,
        hangman_totalGuesses: 0,
        hangman_accuracy: 0,
        hangman_avgGuessesPerGame: 0,
        hangman_avgMistakesPerGame: 0,
        hangman_fastFinishes: 0,
        hangman_fastFinishRate: 0,
        hangman_gamesPlayedLast30: 0,
        hangman_activeDaysLast30: 0,
        hangman_skill: 0,
        hangman_rank: null,
      },
    },
  );

  console.log(`Backfilled hangman stats fields on ${result.modifiedCount} user stats documents.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
