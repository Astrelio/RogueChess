import { sql } from '../db.js'
import type { EngineOps } from './types.js'

/** MAX(ply) actual del match (0 si no hay filas). */
export async function getMaxPly(matchId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(ply), 0) AS ply FROM match_moves WHERE match_id = ${matchId}::uuid
  `
  return Number(rows[0]?.ply ?? 0)
}

export async function getPieceFlags(matchId: string): Promise<Record<string, unknown>[]> {
  const rows = await sql`
    SELECT * FROM match_piece_flags WHERE match_id = ${matchId}::uuid
  `
  return rows as Record<string, unknown>[]
}

/**
 * Persiste las operaciones que devuelve el motor (celdas, flags, efectos,
 * relojes y opcionalmente FEN). Neon = autoridad final.
 */
export async function persistEngineOps(
  matchId: string,
  ops: EngineOps & { newFen?: string },
  opts: { updateFen: boolean; cycleIndex: number },
): Promise<void> {
  if (opts.updateFen && ops.newFen) {
    await sql`UPDATE matches SET fen = ${ops.newFen} WHERE id = ${matchId}::uuid`
  }

  for (const c of ops.cellOps) {
    if (c.op === 'deactivate') {
      await sql`UPDATE match_board_cells SET is_active = FALSE WHERE id = ${c.id}::uuid`
    } else {
      await sql`
        INSERT INTO match_board_cells
          (match_id, square, effect, owner_player_id, payload, created_cycle, expires_cycle,
           time_bonus_min_s, time_bonus_max_s, is_active)
        VALUES (
          ${matchId}::uuid, ${c.square}, ${c.effect}::board_cell_effect,
          ${c.ownerPlayerId ?? null}::uuid, ${JSON.stringify(c.payload ?? {})}::jsonb,
          ${opts.cycleIndex}, ${c.expiresCycle ?? null},
          ${c.timeBonusMinS ?? null}, ${c.timeBonusMaxS ?? null}, TRUE
        )
        ON CONFLICT (match_id, square, effect) DO UPDATE SET
          is_active = TRUE,
          owner_player_id = EXCLUDED.owner_player_id,
          payload = EXCLUDED.payload,
          created_cycle = EXCLUDED.created_cycle,
          expires_cycle = EXCLUDED.expires_cycle
      `
    }
  }

  for (const f of ops.flagOps) {
    if (f.op === 'remove') {
      await sql`
        DELETE FROM match_piece_flags
        WHERE match_id = ${matchId}::uuid AND piece_uid = ${f.pieceUid}
      `
    } else if (f.op === 'move') {
      await sql`
        UPDATE match_piece_flags SET square = ${f.square}, updated_at = now()
        WHERE match_id = ${matchId}::uuid AND piece_uid = ${f.pieceUid}
      `
    } else {
      await sql`
        INSERT INTO match_piece_flags
          (match_id, piece_uid, color, kind, square, was_pawn, is_invisible,
           multijugos_queen, multijugos_dies_ply, payload)
        VALUES (
          ${matchId}::uuid, ${f.pieceUid}, ${f.color}::player_color, ${f.kind}::piece_kind,
          ${f.square}, ${f.wasPawn ?? false}, ${f.isInvisible ?? false},
          ${f.multijugosQueen ?? false}, ${f.multijugosDiesPly ?? null},
          ${JSON.stringify(f.payload ?? {})}::jsonb
        )
        ON CONFLICT (match_id, piece_uid) DO UPDATE SET
          square = EXCLUDED.square,
          was_pawn = EXCLUDED.was_pawn,
          is_invisible = EXCLUDED.is_invisible,
          multijugos_queen = EXCLUDED.multijugos_queen,
          multijugos_dies_ply = EXCLUDED.multijugos_dies_ply,
          payload = EXCLUDED.payload,
          updated_at = now()
      `
    }
  }

  for (const e of ops.effectOps) {
    await sql`UPDATE match_effects SET is_active = FALSE WHERE id = ${e.id}::uuid`
  }

  for (const clk of ops.clockOps) {
    if (clk.color === 'white') {
      await sql`
        UPDATE matches SET white_time_ms = GREATEST(white_time_ms + ${clk.deltaMs}, 0)
        WHERE id = ${matchId}::uuid
      `
    } else {
      await sql`
        UPDATE matches SET black_time_ms = GREATEST(black_time_ms + ${clk.deltaMs}, 0)
        WHERE id = ${matchId}::uuid
      `
    }
    await sql`
      UPDATE match_players SET time_ms = GREATEST(time_ms + ${clk.deltaMs}, 0)
      WHERE match_id = ${matchId}::uuid AND color = ${clk.color}::player_color
    `
  }
}
