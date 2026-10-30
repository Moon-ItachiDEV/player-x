// M433 : relevés de la « BF6 Attachment Database » d'AntiPhysicsGames (v0.9.4, relevé en jeu le 2026-10-12),
// https://github.com/AntiPhysicsGames/battlefield6-attachment-database — licence CC BY-NC-SA 4.0
// (https://creativecommons.org/licenses/by-nc-sa/4.0/) : crédit, pas d'usage commercial, dérivés sous la même licence.
// Ce fichier (leurs relevés repris tels quels) est distribué sous cette même licence.
// Noms des accessoires tels que le jeu les affiche en anglais. Battlefield 6 est une marque d'Electronic Arts.
import type { ArmoryWeapon } from '../types'

export const M433: ArmoryWeapon = {
  id: 'm433',
  name: 'M433',
  category: 'assault-rifle',
  captured: '2026-10-12',
  source: 'antiphysics',
  stats: { dmg: 26, rof: 830, muzzle_velocity: 630, recoil_amount_deg: 0.8, recoil_variation_deg: 41.4, mag: 30, fire_modes: ['Auto', 'Single'], reload_s: 2.384, ads_time_in_ms: 250, headshot_mult: 1.4, long_range_dmg: 17, spot_3d_m: 54, spot_2d_m: 150, regen_delay_s: 5, collateral_mult: 0.75, reload_in_ads: false, ads_move_speed_mult: 0.6, sprint_recovery_ms: 167 },
  bars: { hipfire: 40, precision: 20, control: 40, mobility: 52 },
  recModel: { b: 0.775, s: 0.047 },
  attachments: {
    optic: [
      { name: 'Iron Sights', type: 'Basic Sight', pts: 5, tags: ['+SWAY'] },
      { name: 'Mini Flex 1.00x', type: 'Sight 1.00x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: 'R-MR 1.00x', type: 'Sight 1.00x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: 'OSA-7 1.00x', type: 'Sight 1.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'CQ RDS 1.25x', type: 'Sight 1.25x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: 'RO-S 1.25x', type: 'Sight 1.25x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: '2PRO 1.25x', type: 'Sight 1.25x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'ROX 1.50x', type: 'Sight 1.50x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: 'SU-123 1.50x', type: 'Sight 1.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: '1P87 1.50x', type: 'Sight 1.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'A-P2 1.75x', type: 'Sight 1.75x', pts: 10, enables: ['Canted Iron Sights'] },
      { name: 'RO-M 1.75x', type: 'Sight 1.75x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: '3VZR 1.75x', type: 'Sight 1.75x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'CCO 2.00x', type: 'Sight 2.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'R4T 2.00x', type: 'Sight 2.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Magnifier'] },
      { name: 'BF-2M 2.50x', type: 'Scope 2.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'Baker 3.00x', type: 'Scope 3.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'QMK 3.00x', type: 'Scope 3.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'SDO 3.50x', type: 'Scope 3.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'MGO 3.50x', type: 'Scope 3.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex'] },
      { name: 'PVQ-31 4.00x', type: 'Scope 4.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex'] },
      { name: 'LDS 4.50x', type: 'Scope 4.50x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex'] },
      { name: 'ST Prism 5.00x', type: 'Scope 5.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'SF-G2 5.00x', type: 'Scope 5.00x', pts: 10, enables: ['Canted Iron Sights', 'Canted Reflex', 'Piggyback Reflex'] },
      { name: 'SU-230 LPVO', type: 'Variable 1-4x', pts: 20, tags: ['VARIABLE'] },
      { name: '1P86 LPVO', type: 'Variable 1.5-4.5x', pts: 20, tags: ['VARIABLE'] },
      { name: 'MARS-F LPVO', type: 'Variable 1-5x', pts: 25, tags: ['VARIABLE'] },
      { name: 'MC-CO LPVO', type: 'Variable 1-6x', pts: 25, tags: ['VARIABLE'] },
      { name: 'DVO LPVO', type: 'Variable 1-6x', pts: 25, tags: ['VARIABLE'] },
      { name: 'GRIM 1.50x', type: 'Thermal 1.50x', pts: 25, tags: ['THERMAL'], enables: ['Canted Iron Sights', 'Canted Reflex'] },
      { name: 'PAS-35 3.00x', type: 'Thermal 3.00x', pts: 25, tags: ['THERMAL'], enables: ['Canted Iron Sights', 'Canted Reflex'] },
      { name: 'TH-RDS 1.00x', type: 'Thermal Hybrid', pts: 35, tags: ['THERMAL'] }
    ],
    'optic-accessory': [
      { name: 'Canted Iron Sights', type: 'Basic Sight', pts: 5 },
      { name: 'Canted Reflex', type: 'Sight 1.00x', pts: 10 },
      { name: 'Magnifier', type: 'Magnifier', pts: 10 },
      { name: 'Piggyback Reflex', type: 'Sight 1.00x', pts: 10 }
    ],
    muzzle: [
      { name: 'Flash Hider', type: 'Flash Hider', pts: 10, tags: ['HIDE-3D'], changes: { spot_3d_m: 0 } },
      { name: 'Flash Comp', type: 'Flash Hider', pts: 20, tags: ['HIDE-3D', '+RBLD'], changes: { spot_3d_m: 0 } },
      { name: 'Double-Port Brake', type: 'Brake', pts: 10, tags: ['+REC1'], changes: { precision: 21, control: 42, recoil_amount_deg: 0.7 } },
      { name: 'Compensated Brake', type: 'Brake', pts: 20, tags: ['+REC1', '+RBLD'], changes: { precision: 21, control: 42, recoil_amount_deg: 0.7 } },
      { name: 'Compensator', type: 'Compensator', pts: 10, tags: ['+RBLD'] },
      { name: 'Linear Compensator', type: 'Convertor', pts: 10, tags: ['LINEAR'], changes: { precision: 21, control: 36, recoil_variation_deg: 32.5 } },
      { name: 'Standard Suppressor', type: 'Suppressor', pts: 20, tags: ['HIDE-3D', 'HIDE-MAP', '-HIP'], changes: { hipfire: 34, spot_3d_m: 0, spot_2d_m: 21 } },
      { name: 'Long Suppressor', type: 'Suppressor', pts: 25, tags: ['HIDE-3D', 'HIDE-MAP', '+RBLD', '-HIP', '-SWAY'], changes: { hipfire: 34, spot_3d_m: 0, spot_2d_m: 21 } },
      { name: 'CQB Suppressor', type: 'Suppressor', pts: 30, tags: ['HIDE-3D', 'HIDE-MAP'], changes: { spot_3d_m: 0, spot_2d_m: 21 } },
      { name: 'Lightened Suppressor', type: 'Suppressor', pts: 30, tags: ['HIDE-3D', 'HIDE-MAP', '+RBLD', '-HIP'], changes: { hipfire: 34, spot_3d_m: 0, spot_2d_m: 21 } },
      { name: 'Hybrid Suppressor (L)', type: 'Suppressor', pts: 30, tags: ['HIDE-3D', 'HIDE-MAP', '+RBLD', '+REC1', '-HIP', '-SWAY', '-DRAW'], changes: { hipfire: 34, precision: 21, control: 42, recoil_amount_deg: 0.7, mobility: 50, spot_3d_m: 0, spot_2d_m: 21, sprint_recovery_ms: 200 } },
      { name: 'Hybrid Suppressor (S)', type: 'Suppressor', pts: 40, tags: ['HIDE-3D', 'HIDE-MAP', '+RBLD', '+REC1', '-HIP'], changes: { hipfire: 34, precision: 21, control: 42, recoil_amount_deg: 0.7, spot_3d_m: 0, spot_2d_m: 21 } },
      { name: 'Hybrid Suppressor (K)', type: 'Suppressor', pts: 50, tags: ['HIDE-3D', 'HIDE-MAP', '+RBLD', '+REC1'], changes: { precision: 21, control: 42, recoil_amount_deg: 0.7, spot_3d_m: 0, spot_2d_m: 21 } }
    ],
    barrel: [
      { name: '16.5" Rifle', type: 'Basic', pts: 10 },
      { name: '18.9" Prototype', type: 'Extended', pts: 5, tags: ['+VEL', '-ADS'], changes: { mobility: 48, muzzle_velocity: 787, ads_time_in_ms: 300 } },
      { name: '14.5" Standard', type: 'Short', pts: 15, tags: ['+HIP1', '-VEL'], changes: { hipfire: 47, muzzle_velocity: 504 } },
      { name: '16.5" Fluted', type: 'Light', pts: 20, tags: ['+mACC'], changes: { mobility: 56 } }
    ],
    underbarrel: [
      { name: 'Folding Vertical', type: 'Vertical', pts: 10, tags: ['+REC2', '-mACC'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, mobility: 48 } },
      { name: 'Alloy Vertical', type: 'Vertical', pts: 20, tags: ['+REC2'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7 } },
      { name: 'Ribbed Vertical', type: 'Vertical', pts: 20, tags: ['+REC3', '-mACC'], changes: { precision: 22, control: 47, recoil_amount_deg: 0.7, mobility: 48 } },
      { name: '6H64 Vertical', type: 'Vertical', pts: 25, tags: ['+REC4', '-mACC', '-mSPD'], changes: { precision: 22, control: 50, recoil_amount_deg: 0.6, mobility: 46, ads_move_speed_mult: 0.54 } },
      { name: 'Classic Vertical', type: 'Vertical', pts: 35, tags: ['+REC5', '-mACC', '-mSPD'], changes: { precision: 22, control: 53, recoil_amount_deg: 0.6, mobility: 46, ads_move_speed_mult: 0.54 } },
      { name: 'Folding Stubby', type: 'Stubby', pts: 20, tags: ['+REC2', '+ADS', '-mACC'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, ads_time_in_ms: 200 } },
      { name: 'Ribbed Stubby', type: 'Stubby', pts: 30, tags: ['+REC2', '+ADS'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, ads_time_in_ms: 200, mobility: 56 } },
      { name: 'Canted Stubby', type: 'Stubby', pts: 30, tags: ['+REC3', '+ADS', '-mACC'], changes: { precision: 22, control: 47, recoil_amount_deg: 0.7, ads_time_in_ms: 200 } },
      { name: 'Stippled Stubby', type: 'Stubby', pts: 35, tags: ['+REC4', '+ADS', '-mACC', '-mSPD'], changes: { precision: 22, control: 50, recoil_amount_deg: 0.6, mobility: 50, ads_time_in_ms: 200, ads_move_speed_mult: 0.54 } },
      { name: 'Low-Profile Stubby', type: 'Stubby', pts: 45, tags: ['+REC5', '+ADS', '-mACC', '-mSPD'], changes: { precision: 22, control: 53, recoil_amount_deg: 0.6, mobility: 50, ads_time_in_ms: 200, ads_move_speed_mult: 0.54 } },
      { name: 'Slim Handstop', type: 'Handstop', pts: 15, tags: ['+ADS', '+DRAW'], changes: { mobility: 58, ads_time_in_ms: 200, sprint_recovery_ms: 133 } },
      { name: 'Adjustable Angled', type: 'Angled', pts: 15, tags: ['+REC1', '+ADS', '+DRAW', '-mACC'], changes: { precision: 21, control: 42, recoil_amount_deg: 0.7, mobility: 54, ads_time_in_ms: 200, sprint_recovery_ms: 133 } },
      { name: 'Slim Angled', type: 'Angled', pts: 25, tags: ['+REC1', '+ADS', '+DRAW'], changes: { precision: 21, control: 42, recoil_amount_deg: 0.7, mobility: 58, ads_time_in_ms: 200, sprint_recovery_ms: 133 } },
      { name: 'Full Angled', type: 'Angled', pts: 25, tags: ['+REC2', '+ADS', '+DRAW', '-mACC'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, mobility: 54, ads_time_in_ms: 200, sprint_recovery_ms: 133 } },
      { name: 'Bipod', type: 'Bipod', pts: 10, tags: ['MOUNT'] },
      { name: 'PTT Grip Pod', type: 'Grip Pod', pts: 20, tags: ['MOUNT', '+REC2', '-mACC'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, mobility: 48 } },
      { name: 'QD Grip Pod', type: 'Grip Pod', pts: 30, tags: ['MOUNT', '+REC2'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7 } },
      { name: 'Classic Grip Pod', type: 'Grip Pod', pts: 30, tags: ['MOUNT', '+REC2', '+ADS', '-mACC'], changes: { precision: 21, control: 45, recoil_amount_deg: 0.7, ads_time_in_ms: 200 } },
      { name: 'Actuated Module', type: 'Actuated', pts: 10, tags: ['+SWAY'] }
    ],
    magazine: [
      { name: '30RND Magazine', type: '30 RND', pts: 5 },
      { name: '20RND Fast Mag', type: '20 Fast', pts: 5, tags: ['-MAG', '+RELOAD', '+ADS', '+mSPD2'], changes: { mag: 20, mobility: 64, reload_s: 2.11, ads_time_in_ms: 200, ads_move_speed_mult: 0.75 } },
      { name: '20RND Magazine', type: '20 RND', pts: 5, tags: ['-MAG', '+ADS', '+mSPD2', '+DRAW'], changes: { mag: 20, mobility: 66, ads_time_in_ms: 200, ads_move_speed_mult: 0.75, sprint_recovery_ms: 133 } },
      { name: '30RND Fast Mag', type: '30 Fast', pts: 10, tags: ['+RELOAD', '-DRAW'], changes: { mobility: 50, reload_s: 2.11, sprint_recovery_ms: 200 } },
      { name: '36RND Magazine', type: '36 RND', pts: 15, tags: ['+MAG1', '-mSPD', '-DRAW'], changes: { mag: 36, mobility: 48, ads_move_speed_mult: 0.54, sprint_recovery_ms: 200 } },
      { name: '40RND Magazine', type: '40 RND', pts: 25, tags: ['+MAG2', '-mSPD', '-DRAW'], changes: { mag: 40, mobility: 48, ads_move_speed_mult: 0.54, sprint_recovery_ms: 200 } },
      { name: '40RND Fast Mag', type: '40 Fast', pts: 30, tags: ['+MAG2', '+RELOAD', '-mSPD', '-DRAW2'], changes: { mag: 40, mobility: 46, reload_s: 2.11, ads_move_speed_mult: 0.54, sprint_recovery_ms: 233 } }
    ],
    ammo: [
      { name: 'FMJ', type: 'Standard', pts: 5 },
      { name: 'Tungsten Core', type: 'Penetration', pts: 5, tags: ['+PEN', '-REC1'], changes: { control: 38, collateral_mult: 1 } },
      { name: 'Frangible', type: 'Frangible', pts: 20, tags: ['REGEN-DELAY', '-PEN'], changes: { regen_delay_s: 9, collateral_mult: 0.67 } },
      { name: 'Hollow Point', type: 'Hollow Point', pts: 15, tags: ['+HEAD', '-PEN'], changes: { headshot_mult: 1.57, collateral_mult: 0.67 } },
      { name: 'Polymer Case', type: 'Lightweight', pts: 10, tags: ['+mSPD'], changes: { mobility: 54, ads_move_speed_mult: 0.67 } }
    ],
    accessory: [
      { name: '5 MW Red', type: 'Red Laser', pts: 10, tags: ['+HIP1'], changes: { hipfire: 47 } },
      { name: '50 MW Violet', type: 'Violet Laser', pts: 10, tags: ['+mACC'], changes: { mobility: 56 } },
      { name: '5 MW Green', type: 'Green Laser', pts: 10, tags: ['+HIP2', 'VISIBLE'], changes: { hipfire: 54 } },
      { name: '50 MW Green', type: 'Green Laser', pts: 20, tags: ['+HIP3', 'VISIBLE'], changes: { hipfire: 62 } },
      { name: '50 MW Blue', type: 'Blue Laser', pts: 20, tags: ['+HIP2', '+mACC', 'VISIBLE'], changes: { hipfire: 54, mobility: 56 } },
      { name: '120 MW Blue', type: 'Blue Laser', pts: 30, tags: ['+HIP3', '+mACC', 'VISIBLE'], changes: { hipfire: 62, mobility: 56 } }
    ],
    'right-accessory': [
      { name: 'Taclight - Aimed', type: 'Light', pts: 5, tags: ['BLIND', 'AUTO'] },
      { name: 'Flashlight', type: 'Light', pts: 10, tags: ['BLIND', '+HIP-RBLD'] },
      { name: 'Taclight - HIP', type: 'Light', pts: 15, tags: ['BLIND', '+HIP-RBLD', 'AUTO'] }
    ],
    ergonomics: [
      { name: 'Magwell Flare', type: 'Mag Flare', pts: 10, tags: ['ADS-RELOAD'], changes: { reload_in_ads: true } },
      { name: 'Match Trigger', type: 'Trigger', pts: 15, tags: ['SEMI-ONLY', '+REC1'] }
    ]
  }
}
