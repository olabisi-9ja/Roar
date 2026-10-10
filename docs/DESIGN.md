# Design system

Full board: [design/roar-app-design.html](design/roar-app-design.html).

## Mark

`apps/web/public/mark.svg`: a purple rounded badge with four sound bars, a roar, in orange, yellow, green and blue. App icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) are drawn from the same geometry. The splash animates it: the bars burst out of the badge and fill the four corners of the screen, then the badge settles as the Welcome mark.

The mark is original. Do not use third-party logos or trademarks (league crests, club badges, sponsor marks) in the app, the repo or the demo video.

## Colours

Six colours only. No other hues; tints are opacity on purple or white.

| Token | Hex | Use |
| --- | --- | --- |
| `ink` (purple) | `#3A0648` | Text, nav, primary buttons, video areas |
| `paper` (white) | `#FFFFFF` | Page background |
| `orange` | `#F15326` | Live, SOS, urgent actions, home team in charts. Text on it is purple |
| `yellow` | `#FEB703` | Goals, wins, primary highlights. Text on it is purple |
| `green` | `#82BA03` | Confirmed, success, calm in the chaos meter |
| `blue` | `#00A6ED` | AI, away team in charts |

Text on orange, yellow, green and blue is purple, never white (white on orange is only 3.5:1).

## Type

Anton for headlines, scores and game titles; Barlow Condensed for labels, buttons and numbers; Barlow for body copy.
