---
# See github.com/js13kGames/hello-world for supported frontmatter
---

![](https://github.com/leereilly/rainbow-guardian/raw/main/logo.jpeg)

GitHub is under attack from waves of incoming slop. You, an angry unicorn, must keep the reactor core alive. Maintain the double-rainbow shields and take out slop with your slop cannon.

![](https://github.com/leereilly/rainbow-guardian/raw/main/assets/gameplay.webp)

## Controls

- **SPACE / click / tap**: start the game, and during play, **reverse the horn's orbit** to swing
  its guard toward whichever half is under threat.
- **Firing is automatic**: the horn locks onto the nearest blob inside its wide facing arc.
- **M**: mute / unmute (persists between sessions).
- **P** or **ESC**: pause / resume. The game also auto-pauses when the tab is hidden.
- **Upgrades**: **LEFT / RIGHT** move the selection and **SPACE** confirms, or **tap a card**
  directly. A brief input lock after each screen change prevents accidental picks and reversals.

## The rainbow

Two independent halves (right and left) each start at **100 HP**. A blob that reaches a living
half peels its outer colour bands and pops. When a half is depleted, blobs pour through the gap;
if one reaches the core, the run ends. Threatened halves are outlined in **amber** (incoming) or
**red** (a slinger mid-dash) so you always know where to swing.

## Blobs

Four gelatinous families ooze in, each drawn as a translucent wobbling silhouette with a glassy
shine, googly eyes that track the core, velocity stretch, hit-squash, and a splat of goo on death:

- **GOO**: the basic green drifter.
- **SPLITTER**: a purple blob that bursts into two smaller goos when destroyed.
- **SLINGER**: a pink blob that winds up (dashed outline + telegraph ring), then dashes at the
  rainbow.
- **TANK**: a big, slow, tough blue blob that hits hard and splatters big.

Even waves arrive as mirrored pairs from opposite bearings; odd waves roll straight into the next.
Tougher families unlock as the waves climb.

## Scoring and chains

Every kill without taking rainbow damage extends your **chain**. Each 5 unbroken ki