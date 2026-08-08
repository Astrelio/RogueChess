import {
  defineExtension,
  type BatchRequest,
  type ExtensionContext,
  type ExtensionManifest,
} from '@portalsdk/config'

/** Snapshot liviano para late-joiners (alineado con src/lib/portal.ts). */
type MatchBoardSnapshot = {
  matchId: string
  fen: string
  white_time_ms: number
  black_time_ms: number
  turn_color: string
  status: string
  phase: string
  cycle_index: number
  moves_in_phase: number
  at: number
}

/**
 * Extensión por canal match:*. Guarda el último tablero liviano
 * y lo entrega en channel.ext.matchState al conectar.
 */
class MatchStateExt {
  static manifest: ExtensionManifest = {
    namespace: 'match.state.',
    transport: 'ws',
  }

  #board: MatchBoardSnapshot | null = null

  constructor(private ctx: ExtensionContext) {}

  async onInit() {
    this.#board = (await this.ctx.storage.get<MatchBoardSnapshot>('board')) ?? null
  }

  async onBatch({ messages, batchSeq }: BatchRequest) {
    let last: MatchBoardSnapshot | null = null
    for (const message of messages) {
      if (message.type !== 'match.state.sync') continue
      last = message.content as MatchBoardSnapshot
    }
    if (!last) return

    this.#board = last
    await this.ctx.storage.put('board', last)
    await this.ctx.storage.put('lastSeq', batchSeq)

    return {
      broadcasts: [{ type: 'match.state.updated', content: last }],
      snapshotDirty: true,
    }
  }

  async onSnapshot() {
    if (!this.#board) return
    return { snapshot: this.#board }
  }
}

export default defineExtension(MatchStateExt)
