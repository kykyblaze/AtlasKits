const fs = require('fs');
const path = require('path');

const srcFolder = path.join(__dirname, 'assets', 'Country maps', 'Low');
const destFolder = path.join(__dirname, 'assets', 'maps', 'countries');
const htmlFile = path.join(__dirname, 'ui.src.html');

if (!fs.existsSync(destFolder)) {
  fs.mkdirSync(destFolder, { recursive: true });
}

const htmlContent = fs.readFileSync(htmlFile, 'utf8');
const countriesMatch = htmlContent.match(/const COUNTRIES = \[([\s\S]*?)\];/);
let countries = [];
if (countriesMatch) {
  const arrContent = countriesMatch[1];
  const regex = /name:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(arrContent)) !== null) {
    countries.push(match[1]);
  }
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

const countryMap = new Map();
for (const c of countries) {
  countryMap.set(normalize(c), c);
}

// Handle some common aliases or known mappings
const aliases = {
  'congodr': 'dr congo',
  'eswatini': 'eswatini',
  'easttimor': 'timor-leste',
  'macedonia': 'north macedonia',
  'capeverde': 'cape verde',
  'stkittsnevis': 'saint kitts and nevis',
  'stlucia': 'saint lucia',
  'usa': 'united states',
  'swaziland': 'eswatini',
};

const files = fs.readdirSync(srcFolder).filter(f => f.endsWith('Low.svg'));
const unmatched = [];
const matched = [];

for (const file of files) {
  const base = file.replace(/Low\.svg$/, '');
  const normBase = normalize(base);
  
  let targetName = null;
  if (countryMap.has(normBase)) {
    targetName = countryMap.get(normBase);
  } else if (aliases[normBase] && countryMap.has(normalize(aliases[normBase]))) {
    targetName = countryMap.get(normalize(aliases[normBase]));
  }
  
  if (targetName) {
    const destFile = path.join(destFolder, targetName.toLowerCase() + '.svg');
    const srcFile = path.join(srcFolder, file);
    fs.renameSync(srcFile, destFile);
    matched.push({ file, targetName });
  } else {
    unmatched.push(file);
  }
}

console.log("Matched " + matched.length + " files.");
console.log("Unmatched files:");
console.log(JSON.stringify(unmatched, null, 2));
