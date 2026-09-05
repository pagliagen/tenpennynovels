/**
 * Valutatore di espressioni matematiche — sostituisce `eval()` nelle formule
 * di stat/derived stat (typescript:S1523).
 *
 * Grammatica supportata, deliberatamente minima (copre tutte le formule reali:
 * "EDU*4", "INT/2", "floor((CON + SIZ) / 10)", "min(POW, 99)"):
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := ('+' | '-') factor
 *            | NUMBER
 *            | IDENT '(' args? ')'
 *            | '(' expr ')'
 *   args    := expr (',' expr)*
 *
 * Nessun accesso a variabili, proprietà, stringhe o codice: solo numeri e le
 * funzioni whitelisted qui sotto. Un input malformato lancia `FormulaError`.
 */

export class FormulaError extends Error {}

type Fn = (...args: number[]) => number;

const FUNCTIONS: Record<string, { fn: Fn; minArgs: number; maxArgs: number }> = {
  floor: { fn: Math.floor, minArgs: 1, maxArgs: 1 },
  ceil: { fn: Math.ceil, minArgs: 1, maxArgs: 1 },
  round: { fn: Math.round, minArgs: 1, maxArgs: 1 },
  abs: { fn: Math.abs, minArgs: 1, maxArgs: 1 },
  min: { fn: Math.min, minArgs: 1, maxArgs: Infinity },
  max: { fn: Math.max, minArgs: 1, maxArgs: Infinity },
};

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' | ',' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let num = '';
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        num += input[i];
        i++;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) {
        throw new FormulaError(`Numero non valido: "${num}"`);
      }
      tokens.push({ type: 'num', value });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let ident = '';
      while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z'))) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident.toLowerCase() });
      continue;
    }

    throw new FormulaError(`Carattere non ammesso: "${ch}"`);
  }

  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.pos < this.tokens.length) {
      throw new FormulaError('Token in eccesso nella formula');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new FormulaError('Formula troncata');
    this.pos++;
    return t;
  }

  private expectOp(value: string): void {
    const t = this.next();
    if (t.type !== 'op' || t.value !== value) {
      throw new FormulaError(`Atteso "${value}"`);
    }
  }

  private parseExpr(): number {
    let value = this.parseTerm();
    let t = this.peek();
    while (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      this.next();
      const rhs = this.parseTerm();
      value = t.value === '+' ? value + rhs : value - rhs;
      t = this.peek();
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    let t = this.peek();
    while (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
      this.next();
      const rhs = this.parseFactor();
      value = t.value === '*' ? value * rhs : value / rhs;
      t = this.peek();
    }
    return value;
  }

  private parseFactor(): number {
    const t = this.peek();
    if (!t) throw new FormulaError('Formula troncata');

    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      this.next();
      const operand = this.parseFactor();
      return t.value === '-' ? -operand : operand;
    }

    if (t.type === 'num') {
      this.next();
      return t.value;
    }

    if (t.type === 'ident') {
      this.next();
      const spec = FUNCTIONS[t.value];
      if (!spec) throw new FormulaError(`Funzione sconosciuta: "${t.value}"`);
      this.expectOp('(');
      const args: number[] = [];
      if (!(this.peek()?.type === 'op' && (this.peek() as { value: string }).value === ')')) {
        args.push(this.parseExpr());
        while (this.peek()?.type === 'op' && (this.peek() as { value: string }).value === ',') {
          this.next();
          args.push(this.parseExpr());
        }
      }
      this.expectOp(')');
      if (args.length < spec.minArgs || args.length > spec.maxArgs) {
        throw new FormulaError(`"${t.value}" richiede ${spec.minArgs}..${spec.maxArgs} argomenti, ricevuti ${args.length}`);
      }
      return spec.fn(...args);
    }

    if (t.type === 'op' && t.value === '(') {
      this.next();
      const value = this.parseExpr();
      this.expectOp(')');
      return value;
    }

    throw new FormulaError('Token inatteso nella formula');
  }
}

/**
 * Valuta una formula aritmetica già preprocessata (token stat sostituiti con
 * numeri, nomi funzione in minuscolo senza prefisso `Math.`).
 * Lancia `FormulaError` su input non valido; non ritorna mai NaN/Infinity.
 */
export function evaluateFormula(expression: string): number {
  const result = new Parser(tokenize(expression)).parse();
  if (!Number.isFinite(result)) {
    throw new FormulaError('Risultato non finito');
  }
  return result;
}
