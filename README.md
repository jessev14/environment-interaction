![All Downloads](https://img.shields.io/github/downloads/jessev14/environment-interaction/total?style=for-the-badge)

![Latest Release Download Count](https://img.shields.io/github/downloads/jessev14/environment-interaction/latest/EI.zip)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fenvironment-interaction&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=environment-interaction)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jessev14)

# Environment Interaction

Environemnt Interaction allows GM users to create "environment tokens" that characters can interact with. These interactions can include weapon attacks, skill checks and saves, and even executing macros.

<img src="/img/environment-interaction-demo.gif" height="280"/>


## Usage
An environment token is created like any other token. Once placed on the canvas, the token can be set as an "environment token" using the token configuration window.

Double clicking an environment token will open its Select Action dialog window. GM users will also have a button to open the charcter sheet.

<img src="/img/token-config.png" height="280"/> <img src="/img/action-selection.png" height="280"/>

Selecting an action will use the currently selected token (player character) as the character performing the action. The action will be rolled and carried out using the character's game stats.

To move an environment token, first select it by drag-selection.

Interactions are automatically generated from the items on the environment token's actor sheet.

### Interaction Types
The type of interaction an item has depends on its item type:
* Weapon: Function as if the character had the item on its own actor sheet.
* Consumable: If the item action type is set to "Ability Check," a chat card will be created allowing the character to perform the corresponding check, based on the ability select drop-down. If the item action type is set to "Saving Throw," the chat card will allow the character to perform the corresponding saving throw, based on the saving throw select drop-down.
* Loot: Loot-type items allow the character to execute a macro. To set the macro to be executed, enter the macro's name (exactly) into the "source" input of the item.

See the [img folder](https://github.com/jessev14/environment-interaction/tree/main/img) for example items.

### Item Macro
If an item on an environment token has a set Item Macro, after rolling the item to chat, the Item Macro will be executed.

## System
Environment Interaction currently only supports dnd5e, but please reach out if you'd like to help me support your system!

## Compatibility
Environment Interactions does not *currently* support custom rollers (e.g. Midi-QOL, Better Rolls for 5e, MRE).

## Technical Notes
When an interaction is selected, the correponding item on the environment token's actor sheet is created on the character's actor sheet. After rolling the item to chat, the item is deleted from the character's actor sheet. In this way, the character's actor sheet is the same before and after the interaction.

A similar method is used to handle attack and damage rolls. When attack/damage buttons are clicked, the weapon is temporarily created on the character's actor sheet and used for the attack/damage roll before being deleted. This allows the character's relevant game stats to be used for the roll.
