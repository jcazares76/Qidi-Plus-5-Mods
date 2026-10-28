// Display names for QIDI filament IDs (from QIDI Studio profiles).
export const NAMES: Record<string, string> = {
  QFA00: 'QIDI PLA Basic', QFA01: 'QIDI PLA Matte Basic', QFA02: 'QIDI PLA Rapido',
  QFA03: 'QIDI PLA Rapido Matte', QFA04: 'QIDI PLA Rapido Metal', QFA05: 'QIDI PLA Rapido Silk',
  QFA16: 'QIDI WOOD Rapido', QFA50: 'QIDI PLA-CF', QFA90: 'Generic PLA', QFA91: 'Generic PLA+',
  QFA92: 'Generic PLA Silk', QFB01: 'QIDI ASA', QFB02: 'QIDI ASA-Aero', QFB50: 'QIDI ABS-GF',
  QFB51: 'QIDI ASA-CF20 Core', QFB53: 'QIDI ABS Odorless', QFB54: 'QIDI ABS Rapido',
  QFB55: 'QIDI ABS Rapido Metal', QFB91: 'Generic ABS', QFC02: 'QIDI PC-ABS-FR', QFC90: 'Generic PC',
  QFG00: 'QIDI PETG Basic', QFG02: 'QIDI PETG Rapido', QFG03: 'QIDI PETG Tough',
  QFG04: 'QIDI PETG Translucent', QFG50: 'QIDI PETG-CF', QFG51: 'QIDI PETG-GF', QFG90: 'Generic PETG',
  QFL10: 'HATCHBOX PLA', QFL11: 'HATCHBOX PETG', QFL12: 'HATCHBOX ABS', QFL20: 'PolyLite PLA',
  QFL22: 'PolyLite ABS', QFL24: 'Polymaker PLA-HT', QFL30: 'Bambu PLA', QFL31: 'Bambu PETG',
  QFL32: 'Bambu ABS', QFL60: 'Overture PLA', QFL62: 'Overture ABS', QFN04: 'QIDI PAHT-CF',
  QFN05: 'QIDI PA6-CF', QFN12: 'QIDI PA12-CF', QFN14: 'QIDI PAHT-GF', QFN20: 'QIDI UltraPA',
  QFN21: 'QIDI UltraPA-CF25', QFP01: 'QIDI PPS-CF', QFP02: 'QIDI PPS-GF',
  QFS01: 'QIDI Support For PET-PA', QFS03: 'QIDI Support For PAHT', QFT01: 'QIDI PET-CF',
  QFT02: 'QIDI PET-GF', QFU00: 'QIDI TPU-Aero', QFU01: 'QIDI TPU 95A-HF', QFU02: 'QIDI TPU-GF',
  QFU03: 'QIDI PEBA 95A', QFU91: 'Generic TPU 95A',
};

// QIDI's own color palette (officiall_filas_list.cfg [colordict]).
export const PRESETS = ['FAFAFA', '060606', 'D9E3ED', '5CF30F', '63E492', '2850FF', 'FE98FE', 'DFD628', '228332',
  '99DEFF', '1714B0', 'CEC0FE', 'CADE4B', '1353AB', '5EA9FD', 'A878FF', 'FE717A', 'FF362D', 'E2DFCD', '898F9B',
  '6E3812', 'CAC59F', 'F28636', 'B87F2B'];

export const BUSY_STATES = ['printing', 'paused'];

export const STATE_TITLE: Record<string, string> = {
  standby: 'Ready', printing: 'Printing', paused: 'Paused', complete: 'Complete', cancelled: 'Cancelled',
  error: 'Error', startup: 'Starting up', shutdown: 'Shutdown', disconnected: 'Disconnected',
};

export const CHART_COLORS = ['#ff5252', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da', '#ffee58', '#ec407a'];

/** Console lines from QIDI's automatic light/screen/LED logic, hidden by default. */
export const AUTO_MSG = /SMART_STATUS|smart_output_pin|neopixel|UI_EVENT|caselight\]/i;

export const FAN_PREFIXES = ['fan', 'fan_generic', 'controller_fan', 'heater_fan', 'temperature_fan', 'box_heater_fan'];

/** Rated heater wattages. Draw ≈ 10 s average power × rating. */
export const HEATER_WATTS: Record<string, number> = {
  'extruder': 150, 'heater_bed': 500, 'heater_generic chamber': 550, 'heater_generic heater_box1': 245,
};

/** °C either side of target that counts as "on target". */
export const TEMP_TOL = 2;
/** Seconds of power samples averaged for the Power column. */
export const POWER_AVG_S = 10;
/** Chart length in 1-second samples (10 minutes). */
export const CHART_LEN = 600;

/** Thermals list order: heaters first, safety/monitor sensors (no target) at the bottom. */
export const SENSOR_ORDER = ['extruder', 'heater_bed', 'heater_generic chamber', 'heater_generic heater_box1',
  'temperature_sensor Chamber_Thermal_Protection_Sensor', 'temperature_sensor heater_temp_a_box1',
  'temperature_sensor heater_temp_b_box1'];

/**
 * Toolhead filament sensor (on the toolhead board). box_extras.loaded_slot also reads "slot16" when nothing
 * is loaded, so this sensor decides: no filament at the toolhead = nothing loaded.
 */
export const TOOL_SENSOR = 'filament_switch_sensor filament_switch_sensor';

/** App version – keep in sync with package.json (scripts/package.ps1 checks). */
export const APP_VERSION = '1.1.0';
