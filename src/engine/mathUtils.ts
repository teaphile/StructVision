// Core numerical linear algebra & engineering math utilities (Zero external dependencies)

export interface LinearSolveResult {
  x: number[];
  isSingular: boolean;
  minPivot: number;
}

/**
 * Dense Gaussian elimination with scaled partial pivoting.
 * Safely detects singular / unstable structural mechanisms instead of producing NaN.
 */
export function solveLinearSystem(AInput: number[][], bInput: number[]): LinearSolveResult {
  const n = bInput.length;
  if (n === 0) return { x: [], isSingular: false, minPivot: 1 };

  const A = AInput.map((row) => [...row]);
  const b = [...bInput];

  // Row-norm scaling for robust singularity check across mixed translational & rotational DOFs
  const rowScale = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let maxVal = 0;
    for (let j = 0; j < n; j++) {
      const v = Math.abs(A[i][j]);
      if (v > maxVal) maxVal = v;
    }
    if (maxVal < 1e-13) {
      return { x: new Array(n).fill(0), isSingular: true, minPivot: 0 };
    }
    rowScale[i] = maxVal;
  }

  let minPivot = Infinity;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let bestRatio = -1;
    for (let row = col; row < n; row++) {
      const ratio = Math.abs(A[row][col]) / rowScale[row];
      if (ratio > bestRatio) {
        bestRatio = ratio;
        pivotRow = row;
      }
    }

    if (bestRatio < 1e-10 || Math.abs(A[pivotRow][col]) < 1e-12) {
      return { x: new Array(n).fill(0), isSingular: true, minPivot: 0 };
    }

    if (pivotRow !== col) {
      const tmpRow = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmpRow;

      const tmpB = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tmpB;

      const tmpScale = rowScale[col];
      rowScale[col] = rowScale[pivotRow];
      rowScale[pivotRow] = tmpScale;
    }

    const pivot = A[col][col];
    minPivot = Math.min(minPivot, bestRatio);

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / pivot;
      if (factor === 0) continue;
      A[row][col] = 0;
      for (let k = col + 1; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    x[i] = sum / A[i][i];
  }

  return { x, isSingular: false, minPivot };
}

export interface LUFactorization {
  LU: number[][];
  perm: number[];
  n: number;
  isSingular: boolean;
}

/**
 * LU Factorization with partial pivoting for ultra-fast multi-RHS solves
 * (Used to sweep a 1 kN unit load across 250+ stations in < 0.3 ms for exact ILDs!).
 */
export function luFactorize(AInput: number[][]): LUFactorization {
  const n = AInput.length;
  const LU = AInput.map((r) => [...r]);
  const perm = Array.from({ length: n }, (_, i) => i);

  if (n === 0) return { LU, perm, n: 0, isSingular: false };

  const rowScale = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let maxVal = 0;
    for (let j = 0; j < n; j++) maxVal = Math.max(maxVal, Math.abs(LU[i][j]));
    if (maxVal < 1e-13) return { LU, perm, n, isSingular: true };
    rowScale[i] = maxVal;
  }

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let bestRatio = -1;
    for (let row = col; row < n; row++) {
      const ratio = Math.abs(LU[row][col]) / rowScale[row];
      if (ratio > bestRatio) {
        bestRatio = ratio;
        pivotRow = row;
      }
    }

    if (bestRatio < 1e-10 || Math.abs(LU[pivotRow][col]) < 1e-12) {
      return { LU, perm, n, isSingular: true };
    }

    if (pivotRow !== col) {
      [LU[col], LU[pivotRow]] = [LU[pivotRow], LU[col]];
      [perm[col], perm[pivotRow]] = [perm[pivotRow], perm[col]];
      [rowScale[col], rowScale[pivotRow]] = [rowScale[pivotRow], rowScale[col]];
    }

    const pivot = LU[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = LU[row][col] / pivot;
      LU[row][col] = factor;
      for (let k = col + 1; k < n; k++) {
        LU[row][k] -= factor * LU[col][k];
      }
    }
  }

  return { LU, perm, n, isSingular: false };
}

export function luSolve(fac: LUFactorization, b: number[]): number[] {
  const { LU, perm, n, isSingular } = fac;
  if (isSingular || n === 0) return new Array(n).fill(0);

  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = b[perm[i]];
    for (let j = 0; j < i; j++) {
      sum -= LU[i][j] * y[j];
    }
    y[i] = sum;
  }

  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) {
      sum -= LU[i][j] * x[j];
    }
    x[i] = sum / LU[i][i];
  }
  return x;
}

export function formatNum(val: number, digits = 2): string {
  if (!Number.isFinite(val)) return '0';
  const cleaned = Math.abs(val) < 1e-9 ? 0 : val;
  return cleaned.toFixed(digits);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
