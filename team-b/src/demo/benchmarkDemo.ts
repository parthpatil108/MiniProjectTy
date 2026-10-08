import { benchmarkCache, benchmarkRanking, benchmarkShortlistIndexes, benchmarkRankingApiLoad } from '../services/benchmarkService';

async function main(): Promise<void> {
  console.log('Ranking benchmark:', JSON.stringify(benchmarkRanking(), null, 2));
  console.log('Hash/AVL shortlist benchmark:', JSON.stringify(benchmarkShortlistIndexes(), null, 2));
  console.log('Cache benchmark:', JSON.stringify(benchmarkCache(), null, 2));
  console.log('Ranking API load benchmark:', JSON.stringify(await benchmarkRankingApiLoad(), null, 2));
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
