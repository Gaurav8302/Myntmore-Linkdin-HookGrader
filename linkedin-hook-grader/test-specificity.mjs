import { specificityRule } from './lib/scoring/rules.js';

console.log('Myntmore grew fast:', specificityRule('Myntmore grew fast'));
console.log('LinkedIn strategy:', specificityRule('LinkedIn strategy'));
console.log('Random thoughts on leadership:', specificityRule('Random thoughts on leadership'));