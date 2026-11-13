# Room Tablet Card

A fixed-layout wall-tablet dashboard card for Home Assistant (designed for 1280 × 800, scales to the
screen): light control with two light groups (primary/secondary) and a jog dial, heating, room climate
tiles with history bars, floor plan with window/door contacts, weather, audio/volume control and a
status bar (alarm, persons, open windows, calendar, now playing, clock) on an animated aurora background.

- Card type: `custom:raum-tablet-card`
- Version: 1.21.10
- UI language: German (English translation not yet available).

This is the first-generation card. Its successor with a free block-grid layout and visual editor is
[room_panel_ha_card](https://github.com/SysriX/room_panel_ha_card) (`custom:raum-panel`), which also accepts
this card's configuration unchanged.

> Built for the author's own home; adapt the entity IDs in the examples to your setup.

## Features

- Light: on/off, brightness, color temperature, color (hue/saturation) via a jog dial; two tabs for
  primary/secondary light (or light group); 8 favorite color/white buttons (`favorites`).
- Heating: target temperature dial, modes, tiles for humidity and valve position.
- Room climate (`air`): any number of sensor tiles with good/moderate/bad levels or an optimal range,
  plus history bars in the tile background (`air_history_hours`).
- Floor plan: your own image with window/door contacts (open/tilted/closed), rotatable.
- Audio: up to 4 volume channels as LED tracks, mute, power, source, playback control of the active player.
- Status bar: alarm panel, persons, open windows, calendar, now playing, clock.
- Background: aurora colors following the sun position (computed from the HA location), optional blur.
- Modules can be rearranged in columns via `layout:`.

## Requirements

- Home Assistant 2024.1 or newer.
- Recommended: [room_tablet_ha_theme](https://github.com/SysriX/room_tablet_ha_theme) for matching dialogs.
- Fonts Rajdhani and Share Tech Mono are loaded from Google Fonts. (The optional "Charlie Dotted" LED font is
  applied to this card only when [room_panel_ha_card](https://github.com/SysriX/room_panel_ha_card) is loaded as well.)

## Installation

### HACS (custom repository)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/SysriX/room_tablet_ha_card`, category **Dashboard**.
2. Install **Room Tablet Card**.
3. The resource is `/hacsfiles/room_tablet_ha_card/room_tablet_ha_card.js` (type *JavaScript module*).

### Manual

Copy `dist/room_tablet_ha_card.js` to `/config/www/` (e.g. `/config/www/raum-tablet-card/`) and add it as a
resource (`/local/raum-tablet-card/room_tablet_ha_card.js`, type *JavaScript module*).

## Configuration

```yaml
type: custom:raum-tablet-card

lights:
  primary:
    entity: light.living_room_primary     # light or light group
    name: Primary
    subtitle: Ceiling spots
    color: "#ffb347"
  secondary:
    entity: light.living_room_secondary
    name: Secondary
    subtitle: Strips & floor lamp
    color: "#a36bff"

favorites:                                # 8 color buttons
  - kelvin: 2700
  - hs: [268, 70]

climate:
  entity: climate.living_room
  humidity: sensor.living_room_humidity   # "humidity" tile
  valve: sensor.living_room_valve         # "valve" tile
  title: Heating
  subtitle: Living room radiator
  min: 12
  max: 28

air:
  - { name: CO₂, entity: sensor.living_room_co2, unit: ppm, max: 2000, levels: [1000, 1400] }
  - { name: Humidity, entity: sensor.living_room_humidity, range: [40, 60] }
# air_history_hours: 24

floorplan:
  title: Floor plan
  image: /local/grundriss/living_room.png  # optional, your own image
  aspect: 1.06                             # image width / height
  rotate: 0                                # 0 / 90 / 180 / 270
  contacts:
    - id: W1                               # short label in the marker
      name: Window right                   # legend text
      type: window                         # window or door
      entity: binary_sensor.living_room_window_open
      tilt: binary_sensor.living_room_window_tilted   # optional
      x: 77.8                              # center in % of plan width
      y: 5.9                               # center in % of plan height
      rotate: 0                            # wall: 0 top · 90 right · 180 bottom · 270 left
      length: 22                           # symbol length in % of width
      # hinge: left | right, swing: in | out (doors), symbol: false

media:
  title: Audio
  channels:
    - { name: Main, entity: number.speaker_main_volume }
    - { name: Bass, label: SUB, entity: number.speaker_sub_volume }
  mute: switch.speaker_mute
  power: switch.speaker_power
  source: select.speaker_input_source
  players: [media_player.living_room_tv, media_player.spotify]

weather: weather.forecast_home
alarm: alarm_control_panel.home_alarm
calendar: calendar.family
# persons: [person.alex, person.sam]     # default: all persons

background:
  mode: sun          # sun (default) or off
  animate: true
  blur: 18
  opacity: 0.52
  # latitude: 51.2   # optional, otherwise the HA location
  # longitude: 7.1
```

`layout:` lets you choose which modules appear in which column:

```yaml
layout:
  columns:
    - { width: 404, modules: [light, weather] }
    - { width: 404, modules: [heating, air] }
    - { width: 416, modules: [floorplan, audio] }
  statusbar: true          # false hides the status bar
```

Built-in modules: `light`, `weather`, `heating`, `air`, `floorplan`, `audio` (each at most once). A module
entry can also be `{ module: heating, height: fill | auto | <px> }` or any HA card
(`{ card: { type: tile, entity: … }, height: 90 }`). Modules without configuration (e.g. no `climate:`)
are left out automatically.

Floor plan images are user data (e.g. `/config/www/grundriss/`) and are not part of this repository.

## License

MIT License, see [LICENSE](LICENSE).
