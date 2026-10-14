const { scoreHook } = require('./lib/scoring/index.js');

const hook = "YOU WON'T BELIEVE THIS SECRET!!!";
console.log('Testing hook:', hook);
console.log('Length:', hook.length);

const result = scoreHook(hook);
console.log('Score:', result.score);
console.log('Failed rules:', result.failedRules);
console.log('Passed rules:', result.passedRules);

// Let's also check each rule individually
const { lengthRule, curiosityRule, specificityRule, authorityRule, actionRule, clickbaitPenaltyRule } = require('./lib/scoring/rules.js');
const { SCORING_CONSTANTS } = require('./lib/scoring/constants.js');

console.log('\nIndividual rule results:');
console.log('Length rule:', lengthRule(hook), '(80-160 chars)');
console.log('Curiosity rule:', curiosityRule(hook), '(question or curiosity words)');
console.log('Specificity rule:', specificityRule(hook), '(numbers, timeframes, etc.)');
console.log('Authority rule:', authorityRule(hook), '(first-person + outcome)');
console.log('Action rule:', actionRule(hook), '(imperative or action phrases)');
console.log('Clickbait penalty rule:', clickbaitPenaltyRule(hook), '(no clickbait)');

console.log('\nConstants:');
console.log('Weights:', SCORING_CONSTANTS.weights);