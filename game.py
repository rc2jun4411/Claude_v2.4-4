# 2025-06-18, "game.py" 5x5 grid interactive board game "Echo Hunt".
# phase 1, 6th_step-1 to step-2. To mod function perform_move(). Then mod. a part of while main loop, "elif action == '2'" section and replace it with 
#          only mod. replaced in the main loop partialy.                      
#         final mod. replaced in the main loop partialy. 
# phase 2, replaced mod 31st step-1 function find_ship 2025-06-27
#        , replaced mod 31st step-3 function check_hit                
"""
Phase 1: The Core Logic (Pure Python, Text-Only)
    Goal:           Create a version of Echo Hunt that two people can play sitting at the same computer, taking turns typing in their commands in the terminal.
    Skills Needed:  Basic Python (variables, loops, functions, maybe a simple class).
    My Role(AI):    I will guide you in creating the Python code for the game board, placing ships, checking for hits/echoes, and handling player turns.
phase 2 """
# 12th mod. replaced entire game.py
# 29th mod. replaced def find_ship()

def create_board(size=5):
    """Creates a new game board."""
    return [['~' for _ in range(size)] for _ in range(size)]

# replaced mod 31st step-1
def find_ship(board, ship_marker_to_find):
    """Finds a specific ship ('S1' or 'S2') on a given board."""
    for r_idx, row in enumerate(board):
        for c_idx, cell in enumerate(row):
            if cell == ship_marker_to_find:
                return (r_idx, c_idx)
    return None

# replaced mod 31st step-3
def check_hit(attack_coords, opponent_board, ship_marker_to_find):
    """Checks if an attack is a Hit, Echo, or Miss for a specific ship."""
    attack_row, attack_col = attack_coords

    ship_coords = find_ship(opponent_board, ship_marker_to_find)
    
    if not ship_coords:
        return "MISS" 

    ship_row, ship_col = ship_coords

    if attack_row == ship_row and attack_col == ship_col:
        return "HIT"

    # THE CORRECTED LINE IS HERE
    if abs(attack_row - ship_row) <= 1 and abs(attack_col - ship_col) <= 1:
        return "ECHO"

    return "MISS"
