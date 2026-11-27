# season-meter

A Claude Code mod that turns the desktop app's background into a seasonal scene which fills up as you use your 5-hour session limit, and empties again when the limit resets.

| Season | Months (north) | What fills the screen |
| --- | --- | --- |
| Winter | Dec to Feb | A snow drift rises over the pines while the snowfall thickens |
| Spring | Mar to May | Buds open one by one and the meadow grows tall |
| Summer | Jun to Aug | Birds land on the telephone wires until every spot is taken |
| Fall | Sep to Nov | Leaves leave the tree and pile up until the trunk is buried |

The sun, or the moon in dark mode, sinks toward the horizon as the reset time comes near.

Each scene also has details that stay put and are slowly covered: a house, a lit Christmas tree and a snowman in winter; a pond, a tree in blossom and a rainbow in spring; a farmhouse, sunflowers and a kite in summer; a barn, pumpkins and a scarecrow in fall.

## What it looks like

Each scene below is drawn at 65% of the session limit used. The pictures follow your light or dark mode, as the backdrop does.

<table>
  <tr>
    <td align="center"><img src="images/winter.svg" width="400" alt="Winter: snow drifting high against the pines, with a snowman, a lit Christmas tree and a house in the hollow"><br>Winter</td>
    <td align="center"><img src="images/spring.svg" width="400" alt="Spring: a meadow with most of its flowers open and growing tall, a pond, a tree in blossom and a rainbow"><br>Spring</td>
  </tr>
  <tr>
    <td align="center"><img src="images/summer.svg" width="400" alt="Summer: birds perched along four telephone wires above a farmhouse, sunflowers and hay bales"><br>Summer</td>
    <td align="center"><img src="images/fall.svg" width="400" alt="Fall: a tree that has lost most of its leaves to a mound below, with a scarecrow, pumpkins and a barn"><br>Fall</td>
  </tr>
</table>

## Install

At the prompt of a terminal session:

```
/plugin install season-meter --marketplace Thisara-DE/season-meter
```

Answer `y` to add the marketplace, then pick a scope (the user scope loads it in every session).

From a shell:

```
claude plugin install season-meter --marketplace Thisara-DE/season-meter
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Thisara-DE/season-meter`, then Add plugin.

## Use

- The backdrop draws by itself in the Claude desktop and mobile apps. The terminal and VS Code draw no backdrop.
- `/season fall 80` previews any season at any percentage; `/season live` goes back to the real reading.
- The `hemisphere` option (`north` or `south`) picks whose seasons to follow.
- The scene moves when Claude replies, since that is when a new reading of the limit arrives. With no subscription limit to read, the scene stays empty.

## Requirements

Claude Code v2.1.319 or later, for the backdrop.

## What it can do

A mod is code that runs inside Claude Code with your permissions. This one reads the session's usage figures and the clock, registers the `/season` command and draws the backdrop. It reads no files and makes no network requests. Run `claude plugin validate` on the folder to see the hooks and calls for yourself.

## License

MIT
