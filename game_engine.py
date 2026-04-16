# EchoHunt v2.4 - game_engine.py
# MERGED: v2.2 base + v2.3 improvements
#
# From v2.2 (preserved):
#   ✅ Core place_ship, perform_hit, perform_move, new_game, erase_tracking_board
#   ✅ get_state() structure
#
# From v2.3 (added):
#   ✅ battle_log: log() method, all actions logged
#   ✅ BUG FIX: perform_hit() no longer switches turn — server.py handles it
#              to prevent double-switch overwriting GAME_OVER
#   ✅ perform_move() logs direction for battle log display
#   ✅ Bounds checking in perform_move()

import game

class GameEngine:
    def __init__(self, game_id, p1_sid, p2_sid):
        self.game_id = game_id
        self.players = {"p1": p1_sid, "p2": p2_sid}
        self.boards = {}
        self.battle_log = []
        self.new_game()

    # v2.3: battle log helper
    def log(self, event, player, row=None, col=None, result=None):
        entry = {"event": event, "player": player}
        if row is not None: entry["row"] = row
        if col is not None: entry["col"] = col
        if result is not None: entry["result"] = result
        self.battle_log.append(entry)

    def place_ship(self, player_num, row, col):
        board = self.boards[f"p{player_num}_primary_board"]
        for r in range(len(board)):
            for c in range(len(board[r])):
                if board[r][c] == f'S{player_num}':
                    board[r][c] = '~'
        board[row][col] = f'S{player_num}'
        self.log("PLACE", player_num, row=row, col=col)
        if player_num == 1:
            self.phase = "SETUP_P2"
            self.message = "Player 2, place your ship."
        else:
            self.phase = "P1_TURN"
            self.message = "Player 1's Turn. Choose an action."
        return True

    def perform_hit(self, player_num, row, col):
        """
        Performs a hit attempt.
        BUG FIX: Turn switching removed from here — handled in server.py only,
        to prevent double-switch that would overwrite GAME_OVER phase.
        """
        own_board = self.boards[f"p{player_num}_primary_board"]
        defender_board = self.boards[f"p{3 - player_num}_primary_board"]
        tracking_board = self.boards[f"p{player_num}_tracking_board"]

        attacker_pos = game.find_ship(own_board, f"S{player_num}")
        if not attacker_pos:
            return "Your ship not found."
        if not (abs(row - attacker_pos[0]) <= 1 and abs(col - attacker_pos[1]) <= 1):
            return "Invalid target. You can only hit adjacent squares."
        if (row, col) == attacker_pos:
            return "Invalid target. You cannot hit your own square."

        result = game.check_hit((row, col), defender_board, f"S{3 - player_num}")

        if result == "HIT":
            tracking_board[row][col] = 'X'
            self.phase = "GAME_OVER"
            self.message = f"Player {player_num} wins! Direct Hit!"
        elif result == "ECHO":
            tracking_board[row][col] = 'O'
            self.message = f"Player {player_num} scores an ECHO!"
        else:
            tracking_board[row][col] = 'M'
            self.message = f"Player {player_num} scores a MISS!"

        self.log("HIT_ATTEMPT", player_num, row=row, col=col, result=result)
        return True

    def perform_move(self, player_num, row, col):
        board = self.boards[f"p{player_num}_primary_board"]
        defender_board = self.boards[f"p{3 - player_num}_primary_board"]

        current_pos = game.find_ship(board, f"S{player_num}")
        if not current_pos:
            return "Your ship not found."
        if not (abs(row - current_pos[0]) <= 1 and abs(col - current_pos[1]) <= 1):
            return "Invalid move. You can only move to an adjacent square."
        if (row, col) == current_pos:
            return "Invalid move. Choose a different square."

        defender_pos = game.find_ship(defender_board, f"S{3 - player_num}")
        if defender_pos and (row, col) == defender_pos:
            return "Invalid move. Cannot move to a square occupied by the opponent."

        # Bounds check
        board_size = len(board)
        if not (0 <= row < board_size and 0 <= col < board_size):
            return "Invalid move. Out of bounds."

        # Direction label for battle log
        dr = row - current_pos[0]
        dc = col - current_pos[1]
        direction_map = {
            (-1, 0): "UP", (1, 0): "DOWN", (0, -1): "LEFT", (0, 1): "RIGHT",
            (-1, -1): "UP-LEFT", (-1, 1): "UP-RIGHT",
            (1, -1): "DOWN-LEFT", (1, 1): "DOWN-RIGHT",
        }
        direction = direction_map.get((dr, dc), "UNKNOWN")

        board[current_pos[0]][current_pos[1]] = '~'
        board[row][col] = f"S{player_num}"
        self.message = f"Player {player_num} has moved."
        self.log("MOVE", player_num, row=row, col=col, result=direction)
        return True

    def new_game(self):
        self.phase = "SETUP_P1"
        self.message = "New Game! Player 1, place your ship."
        self.boards = {
            "p1_primary_board": game.create_board(),
            "p2_primary_board": game.create_board(),
            "p1_tracking_board": game.create_board(),
            "p2_tracking_board": game.create_board(),
        }
        self.battle_log = []
        self.log("NEW_GAME", None)
        return True

    def erase_tracking_board(self, player_num):
        self.boards[f"p{player_num}_tracking_board"] = game.create_board()
        self.log("ERASE_TRACKING", player_num)
        return True

    def get_state(self):
        return {
            "game_id": self.game_id,
            "phase": self.phase,
            "message": self.message,
            "battle_log": self.battle_log,
            "p1_primary_board": self.boards.get("p1_primary_board", []),
            "p2_primary_board": self.boards.get("p2_primary_board", []),
            "p1_tracking_board": self.boards.get("p1_tracking_board", []),
            "p2_tracking_board": self.boards.get("p2_tracking_board", []),
        }
