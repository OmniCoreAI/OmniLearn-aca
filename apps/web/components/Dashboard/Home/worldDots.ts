/**
 * Dotted world-map land mask, baked from Natural Earth 1:50m land (public domain,
 * via world-atlas). Equirectangular grid: 96 columns x 36 rows covering
 * longitude -180..180 and latitude 80..-55.0.
 * Each row is run-length encoded as alternating water/land cell counts, starting with water.
 */
export const WORLD_COLS = 96
export const WORLD_ROWS = 36
export const WORLD_LAT_TOP = 80
export const WORLD_CELL_DEG = 3.75

const RLE = [
  '21.2.2.3.1.13.10.1.23.1.19',
  '15.1.17.10.20.1.7.6.19',
  '5.2.11.2.2.1.1.6.3.7.14.2.10.1.1.23.5',
  '0.1.4.20.4.3.2.5.13.7.2.6.1.28',
  '5.19.5.2.3.3.13.3.1.42',
  '5.3.3.12.4.2.20.4.1.32.2.1.2.1.4',
  '12.13.2.5.14.2.2.2.2.30.5.2.5',
  '0.1.13.12.1.6.12.1.1.1.1.37.10',
  '15.14.1.1.1.2.13.38.11',
  '15.16.17.3.1.4.2.26.12',
  '15.13.18.2.2.1.1.2.2.5.1.18.1.1.3.1.10',
  '16.12.18.1.3.1.4.25.2.1.1.2.10',
  '17.10.19.5.6.23.3.1.12',
  '17.6.22.16.1.19.15',
  '19.3.4.1.17.13.1.3.2.17.16',
  '20.2.3.1.17.21.2.5.1.6.18',
  '21.4.2.1.16.14.1.4.4.3.3.3.4.1.15',
  '23.3.17.18.7.1.5.3.19',
  '25.1.2.2.14.18.6.1.7.1.19',
  '27.5.13.16.8.1.26',
  '27.7.17.9.14.2.2.1.17',
  '27.8.15.9.16.1.1.2.4.1.12',
  '26.12.13.8.16.1.4.1.3.3.1.1.7',
  '27.12.13.7.18.2.6.1.1.1.2.1.5',
  '27.11.14.7.24.1.12',
  '28.10.13.8.1.1.20.3.2.1.9',
  '29.8.14.6.3.1.19.7.9',
  '29.7.16.5.3.1.17.10.8',
  '29.6.17.5.21.11.7',
  '29.6.18.3.23.10.7',
  '29.3.1.1.19.1.25.1.5.3.8',
  '28.5.53.1.8.1',
  '29.2.56.1.8',
  '28.2.62.2.2',
  '28.2.36.1.29',
  '29.1.66',
]

/** [column, row] of every land cell. */
export const WORLD_LAND_CELLS: ReadonlyArray<readonly [number, number]> = RLE.flatMap((row, r) => {
  const cells: [number, number][] = []
  let col = 0
  row.split('.').forEach((count, i) => {
    const n = Number(count)
    if (i % 2 === 1) for (let k = 0; k < n; k++) cells.push([col + k, r])
    col += n
  })
  return cells
})

/** Project a coordinate onto the grid (fractional column/row). */
export function projectToGrid(lat: number, lon: number): [number, number] {
  return [(lon + 180) / WORLD_CELL_DEG - 0.5, (WORLD_LAT_TOP - lat) / WORLD_CELL_DEG - 0.5]
}
