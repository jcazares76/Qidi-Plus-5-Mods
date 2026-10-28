; OrcaSlicer machine start G-code from 'Qidi X-Plus 5 0.4 nozzle - UPS Safe'
; (readable copy of machine_start_gcode in the .json next to this file)

;===== PRINT_PHASE_INIT =====
; This is to hardcode the filament slots in Orca to the filament slots in the Qidi Box, left to right
SAVE_VARIABLE VARIABLE=value_t0 VALUE="'slot0'"
SAVE_VARIABLE VARIABLE=value_t1 VALUE="'slot1'"
SAVE_VARIABLE VARIABLE=value_t2 VALUE="'slot2'"
SAVE_VARIABLE VARIABLE=value_t3 VALUE="'slot3'"

SET_PRINT_STATS_INFO TOTAL_LAYER=[total_layer_count]
SET_PRINT_MAIN_STATUS MAIN_STATUS=print_start
M220 S100
M221 S100
DISABLE_ALL_SENSOR
M1002 R1
M107
CLEAR_PAUSE
G29.0
SET_PRINT_SUB_STATUS SUB_STATUS=tool_head_reset
G28
;===== SEQUENTIAL HEAT: BED (wait for full bed temp before anything else heats) =====
SET_PRINT_SUB_STATUS SUB_STATUS=wait_bed_temp
M140 S[bed_temperature_initial_layer_single]
M190 S[bed_temperature_initial_layer_single]
;===== SEQUENTIAL HEAT: CHAMBER (waits for target; instant no-op if target is 0) =====
SET_PRINT_SUB_STATUS SUB_STATUS=wait_chamber_temp
M141 S[overall_chamber_temperature]
M191 S[overall_chamber_temperature]
;===== BOX_PREPAR ===== (nozzle heating only starts here, after bed is at temp)
SET_PRINT_SUB_STATUS SUB_STATUS=change_filament
BOX_PRINT_START EXTRUDER=[initial_no_support_extruder] HOTENDTEMP={nozzle_temperature_range_high[initial_tool]}
M400
EXTRUSION_AND_FLUSH HOTEND=[nozzle_temperature_initial_layer]
;===== CLEAR_NOZZLE =====
SET_PRINT_SUB_STATUS SUB_STATUS=flush_filament
G1 Z20 F480
MOVE_TO_TRASH
{if overall_chamber_temperature == 0}
M106 P3 S[during_print_exhaust_fan_speed]
{else}
M106 P3 S0
{endif}
M1004
M106 S0
M109 S[nozzle_temperature_initial_layer]
G92 E0
M83
G1 E5 F80
G1 E200 F300
M400
M106 S255
G1 E-3 F1000
M104 S140
SET_PRINT_SUB_STATUS SUB_STATUS=clear_nozzle
M109.1 S{nozzle_temperature_initial_layer[0]-30}
M204 S10000
G1 X109 F10000
G1 X95 F6000
G1 X109 F10000
G1 X95 F6000
G1 X109 F10000
G1 X95 F6000
G1 Y318
G1 X151 F15000
G1 Y327
G1 Z5 F480
M400
probe samples=1
G91
G1 Z0.1
G90
M106 S255
M109.1 S150
G91
G1 X20 F200
G1 Y3
G1 X-20
G1 Y-3
G1 X20
G90
G2 I0.5 J0.5 F480
G2 I0.5 J0.5
G2 I0.5 J0.5
G1 Z10
G1 Y318 F12000
G1 X77
G1 Y338 F2000
G1 X95 F12000
G1 X123
G1 X110
G1 X123
G1 X110
G1 X123
G1 X110
G1 X123
G1 X110
G1 X140
G1 X160 Y160
M106 S0
G1 Y-2 F15000
G1 X15
G1 X-2 F5000
G4 P1000
G1 X-1 F1000
G1 X-2 F5000
G4 P1000
G1 E-4 F1800
G1 X15 F3000
G1 X20 Y20 F15000
SET_PRINT_SUB_STATUS SUB_STATUS=z_tilt_adjust
Z_TILT_ADJUST
SET_PRINT_SUB_STATUS SUB_STATUS=auto_bed_adjust
G29
M1002 A1
G1 X160 Y160 Z10 F20000
M1006 Z{10 - ((nozzle_temperature_initial_layer[initial_tool] - 130) / 14 - 5.0) / 100}
G0 Y-1
M109 S[nozzle_temperature_initial_layer]
ENABLE_ALL_SENSOR
; QIDI Box heats to the lowest drying limit of the spools in it (off with PLA) - needs box_slots.cfg
AUTO_BOX_TEMP
;===== PRINT_START =====
; LAYER_HEIGHT: 0.2
T[initial_tool]
M140 S[bed_temperature_initial_layer_single]
M104 S[nozzle_temperature_initial_layer]
M141 S[overall_chamber_temperature]
G4 P3000
probe samples=1
G91
G0 Z0.6 F480
G90
G1 X140 Y1 F20000
G1 E5 F{filament_max_volumetric_speed[initial_no_support_extruder]/2/2.4053*60}
G1 X180 E20 F{filament_max_volumetric_speed[initial_no_support_extruder]/2/2.4053*60}
G1 Z1 F480
SET_PRINT_MAIN_STATUS MAIN_STATUS=printing
