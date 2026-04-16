# EchoHunt v2.4 - server.py
# MERGED: v2.2 base + v2.3 improvements
#
# From v2.2 (preserved):
#   ✅ Core connect, player_ready, handle_action, disconnect structure
#
# From v2.3 (added):
#   ✅ assign_player event sent on connect and player_ready
#   ✅ BUG FIX: HIT turn-switch skips when phase is GAME_OVER
#   ✅ Render deployment: host 0.0.0.0, PORT env var
#   ✅ show_index=False (security: don't list directory)

import socketio, aiohttp, uuid, os
from aiohttp import web
from game_engine import GameEngine

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)
app.router.add_static('/', path='.', show_index=False)

games = {}
waiting_player_sid = None
players_ready = {}


async def broadcast_gamestate(game_id: str):
    if game_id not in games:
        return
    engine = games[game_id]
    state = engine.get_state()
    p1_sid = engine.players["p1"]
    p2_sid = engine.players["p2"]
    await sio.emit('game_update', {**state, 'my_player_number': 1}, room=p1_sid)
    await sio.emit('game_update', {**state, 'my_player_number': 2}, room=p2_sid)


@sio.event
async def connect(sid, environ):
    global waiting_player_sid
    print(f"SERVER: Player connected: {sid}")

    if waiting_player_sid:
        p1_sid, p2_sid = waiting_player_sid, sid
        waiting_player_sid = None
        game_id = str(uuid.uuid4())

        games[game_id] = GameEngine(game_id, p1_sid, p2_sid)

        await sio.emit('game_found', {'game_id': game_id}, room=p1_sid)
        await sio.emit('game_found', {'game_id': game_id}, room=p2_sid)
        # v2.3: tell each client which player number they are
        await sio.emit('assign_player', {'player': 1}, to=p1_sid)
        await sio.emit('assign_player', {'player': 2}, to=p2_sid)
    else:
        waiting_player_sid = sid
        await sio.emit('message', {'data': 'Connected. Waiting for another player...'}, room=sid)


@sio.event
async def player_ready(sid, data):
    game_id = data.get("game_id")
    if not game_id:
        return

    if game_id not in players_ready:
        players_ready[game_id] = []
    if sid not in players_ready[game_id]:
        players_ready[game_id].append(sid)

    if len(players_ready[game_id]) == 2:
        p1_sid, p2_sid = players_ready[game_id]
        games[game_id] = GameEngine(game_id, p1_sid, p2_sid)
        del players_ready[game_id]
        print(f"SERVER: Both players ready for game {game_id}. Starting.")
        # v2.3: assign player numbers on game start too
        await sio.emit('assign_player', {'player': 1}, room=p1_sid)
        await sio.emit('assign_player', {'player': 2}, room=p2_sid)
        await broadcast_gamestate(game_id)


@sio.event
async def handle_action(sid, data):
    game_id = data.get("game_id")
    if not game_id or game_id not in games:
        return

    engine = games[game_id]
    player_num = 1 if sid == engine.players["p1"] else 2
    action_type = data.get("action_type")
    row = data.get("row", 0)
    col = data.get("col", 0)

    result = None

    if action_type == "place-ship":
        result = engine.place_ship(player_num, row, col)

    elif action_type == "hit":
        if engine.phase not in ["P1_TURN", "P2_TURN"]:
            return
        result = engine.perform_hit(player_num, row, col)
        # Do NOT switch turn — client sends next_turn after 10s Tactical Pause.

    elif action_type == "move":
        result = engine.perform_move(player_num, row, col)
        # Do NOT switch turn — client sends next_turn after 10s Tactical Pause.

    elif action_type == "erase_tracking":
        result = engine.erase_tracking_board(player_num)

    elif action_type == "new_game":
        result = engine.new_game()

    elif action_type == "next_turn":
        # Called by client after 10s Tactical Pause
        if engine.phase == "P1_TURN":
            engine.phase = "P2_TURN"
            engine.message = "Player 2's Turn. Choose an action."
        elif engine.phase == "P2_TURN":
            engine.phase = "P1_TURN"
            engine.message = "Player 1's Turn. Choose an action."
        result = True

    if result is not True and result is not None:
        await sio.emit('error_message', {'message': str(result)}, room=sid)

    await broadcast_gamestate(game_id)


@sio.event
def disconnect(sid):
    print(f'SERVER: Player disconnected: {sid}')


if __name__ == '__main__':
    # v2.3: Render deployment — binds to 0.0.0.0 and reads PORT from environment
    web.run_app(app, host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
