// Gera src/styles/dark-remap.css: no modo escuro, as cores claras fixas das classes do Tailwind
// (bg-white, bg-rose-50, text-amber-800…) passam a equivalentes escuros, sem mexer em cada ecrã.
// Correr de novo depois de mudar as regras: node scripts/gen-dark-css.mjs
import { writeFileSync } from 'node:fs';

const BS = String.fromCharCode(92);
const P = ':where(html.rz-theme.dark)';
const esc = name => name.replace(/[/:.[\]]/g, char => BS + char);
const rules = [];

/** Regra para a classe e as variantes hover:/group-hover:. */
const add = (cls, decl, { hover = true } = {}) => {
  rules.push(`${P} .${esc(cls)} { ${decl} }`);
  if (hover) {
    rules.push(`${P} .${esc(`hover:${cls}`)}:hover { ${decl} }`);
    rules.push(`${P} .group:hover .${esc(`group-hover:${cls}`)} { ${decl} }`);
  }
};

const COLORS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];
const NEUTRALS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const color = (c, shade, alpha) => `theme('colors.${c}.${shade}${alpha ? ` / ${alpha}` : ''}')`;

// Branco e preto.
add('bg-white', 'background-color: hsl(var(--rz-surface));');
for (const a of [60, 70, 80, 90, 95])
  add(`bg-white/${a}`, `background-color: hsl(var(--rz-surface) / ${a / 100});`);
add('text-black', 'color: hsl(0 0% 95%);');
add('bg-black/5', 'background-color: hsl(0 0% 100% / 0.06);');
add('bg-black/10', 'background-color: hsl(0 0% 100% / 0.1);');
add('border-white/60', 'border-color: hsl(var(--rz-line));', { hover: false });
for (const a of [5, 10]) add(`ring-black/${a}`, '--tw-ring-color: hsl(0 0% 100% / 0.08);');
add(
  'from-white',
  '--tw-gradient-from: hsl(var(--rz-surface)) var(--tw-gradient-from-position); --tw-gradient-to: hsl(var(--rz-surface) / 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);',
  { hover: false }
);
add('to-white', '--tw-gradient-to: hsl(var(--rz-surface)) var(--tw-gradient-to-position);', {
  hover: false,
});

// Cinzentos: fundos claros → superfícies escuras; texto escuro → claro.
for (const n of NEUTRALS) {
  add(`bg-${n}-50`, 'background-color: hsl(var(--rz-canvas));');
  add(`bg-${n}-100`, 'background-color: hsl(0 0% 13%);');
  add(`bg-${n}-200`, 'background-color: hsl(0 0% 18%);');
  add(`text-${n}-500`, 'color: hsl(0 0% 58%);');
  add(`text-${n}-600`, 'color: hsl(0 0% 66%);');
  add(`text-${n}-700`, 'color: hsl(0 0% 78%);');
  for (const s of [800, 900, 950]) add(`text-${n}-${s}`, 'color: hsl(0 0% 92%);');
  for (const s of [100, 200, 300]) {
    add(`border-${n}-${s}`, 'border-color: hsl(var(--rz-line));');
    add(`ring-${n}-${s}`, '--tw-ring-color: hsl(var(--rz-line));');
  }
}

// Cores: fundos pastel → a cor em transparência; texto escuro → tom claro da mesma cor.
for (const c of COLORS) {
  add(`bg-${c}-50`, `background-color: ${color(c, 500, '10%')};`);
  add(`bg-${c}-100`, `background-color: ${color(c, 500, '16%')};`);
  add(`bg-${c}-200`, `background-color: ${color(c, 500, '24%')};`);
  for (const a of [20, 30, 40, 50, 60])
    add(`bg-${c}-50/${a}`, `background-color: ${color(c, 500, '8%')};`);
  add(`text-${c}-600`, `color: ${color(c, 400)};`);
  for (const s of [700, 800, 900, 950]) {
    add(`text-${c}-${s}`, `color: ${color(c, 300)};`);
    for (const a of [40, 70, 80]) add(`text-${c}-${s}/${a}`, `color: ${color(c, 300, `${a}%`)};`);
  }
  for (const s of [100, 200, 300]) {
    add(`border-${c}-${s}`, `border-color: ${color(c, 500, '35%')};`);
    add(`ring-${c}-${s}`, `--tw-ring-color: ${color(c, 500, '35%')};`);
  }
}

// Degradês claros (cartões de comunicado e apreciação, ícones): a ordem from → via → to é a do
// Tailwind, porque via e to mexem na mesma variável.
const gradient = { from: [], via: [], to: [] };
const stop = (kind, cls, value) => {
  const decl = {
    from: `--tw-gradient-from: ${value(1)} var(--tw-gradient-from-position); --tw-gradient-to: ${value(0)} var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`,
    via: `--tw-gradient-to: ${value(0)} var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), ${value(1)} var(--tw-gradient-via-position), var(--tw-gradient-to);`,
    to: `--tw-gradient-to: ${value(1)} var(--tw-gradient-to-position);`,
  }[kind];
  gradient[kind].push(`${P} .${esc(cls)} { ${decl} }`);
};
for (const kind of ['from', 'via', 'to']) {
  for (const c of COLORS)
    for (const [shade, alpha] of [
      [50, 14],
      [100, 20],
    ])
      stop(kind, `${kind}-${c}-${shade}`, on => color(c, 500, `${on ? alpha : 0}%`));
  if (kind === 'via') stop(kind, 'via-white', on => `hsl(var(--rz-surface) / ${on})`);
}
rules.push(...gradient.from, ...gradient.via, ...gradient.to);

const header =
  '/* Gerado por scripts/gen-dark-css.mjs — não editar à mão.\n' +
  ' * Modo escuro: cores claras fixas do Tailwind → equivalentes escuros. :where() deixa a\n' +
  ' * especificidade igual à da classe original, e este ficheiro carrega depois do Tailwind. */\n';
writeFileSync('src/styles/dark-remap.css', header + rules.join('\n') + '\n');
console.warn(`${rules.length} regras`);
