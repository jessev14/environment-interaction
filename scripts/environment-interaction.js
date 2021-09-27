import { libWrapper } from "../lib/shim.js"

export const moduleName = "environment-interaction";


Hooks.once("init", () => {
    // Open module API
    window.EnvironmentInteraction = EnvironmentInteraction;

    // Register settings
    window.EnvironmentInteraction.registerSettings();

    // Register Handlebars helpers
    window.EnvironmentInteraction.registerHandlebarsHelpers();
});

Hooks.once("setup", () => {
    // Register wrappers
    window.EnvironmentInteraction.registerWrappers();

});

Hooks.once("ready", () => {
    // Register hook callbacks
    window.EnvironmentInteraction.registerHooks();
});


class EnvironmentInteraction {
    // Settings
    static registerSettings() {
        // Automatically close interaction selection dialog
        game.settings.register(moduleName, "closeDialog", {
            name: game.i18n.localize(`${moduleName}.settings.closeDialog.name`),
            hint: "",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });

        // Automatically add proficiency to attack rolls
        game.settings.register(moduleName, "autoProficiency", {
            name: game.i18n.localize(`${moduleName}.settings.autoProficiency.name`),
            hint: "",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });
    }

    // Handlebars Helpers
    static registerHandlebarsHelpers() {
        // dnd5e specific
        Handlebars.registerHelper('ei-type', item => {
            const { type } = item;
            const actionType = item.data.data.actionType;
            const typeDict = {
                weapon: game.i18n.localize("DND5E.ItemTypeWeapon"),
                consumable: actionType === "abil" ? game.i18n.localize("DND5E.ActionAbil") : actionType === "save" ? game.i18n.localize("DND5E.ActionSave") : "Skill Check",
                loot: game.i18n.localize(`${moduleName}.handlebarsHelper.Macro`)
            };

            return typeDict[type];
        });
    }

    // Wrappers
    static registerWrappers() {
        // Alter mouse interaction for tokens flagged as environment
        libWrapper.register(moduleName, "CONFIG.Token.objectClass.prototype._canView", window.EnvironmentInteraction._canView, "MIXED");
        libWrapper.register(moduleName, "CONFIG.Token.objectClass.prototype._onClickLeft", window.EnvironmentInteraction._onClickLeft, "MIXED");
        libWrapper.register(moduleName, "CONFIG.Token.objectClass.prototype._onClickLeft2", window.EnvironmentInteraction._onClickLeft2, "MIXED");

        // dnd5e handling of chat message buttons
        if (game.system.id === "dnd5e") libWrapper.register(moduleName, "CONFIG.Item.documentClass._onChatCardAction", window.EnvironmentInteraction._onChatCardAction, "MIXED");
    }

    static _canView(wrapped, ...args) {
        // If token is an environment token, then any use can "view" (allow _clickLeft2 callback)
        if (this.document.getFlag(moduleName, "environmentToken")) return true;
        else return wrapped(...args);
    }

    static _onClickLeft(wrapped, event) {
        // Prevent deselection of currently controlled token when clicking environment token
        if (!this.document.getFlag(moduleName, "environmentToken")) return wrapped(event);
    }

    static _onClickLeft2(wrapped, event) {
        if (!this.document.getFlag(moduleName, "environmentToken")) return wrapped(event);
        else window.EnvironmentInteraction.interactWithEnvironment(this, event);
    }

    static async _onChatCardAction(wrapped, event) {
        const button = event.currentTarget;
        const chatMessageID = $(button).closest(`li.chat-message`).data("message-id");
        const chatMessage = game.messages.get(chatMessageID);
        const useData = chatMessage.getFlag(moduleName, "useData");

        if (!useData) return wrapped(event);

        const { itemID, environmentTokenID, interactorTokenID } = useData;
        const environment = canvas.tokens.get(environmentTokenID).actor;
        const interactor = canvas.tokens.get(interactorTokenID).actor;
        const environmentItem = environment.items.get(itemID);

        const action = $(button).data("action");
        let interactorItem;

        if (["attack", "damage"].includes(action)) [interactorItem] = await interactor.createEmbeddedDocuments("Item", [environmentItem.toObject()]);
        if (["ability", "save"].includes(action)) {
            Hooks.once("renderDialog", (dialog, html, dialogData) => {
                dialog.setPosition({ top: event.clientY - 50 ?? null, left: window.innerWidth - 710 });
            });
        }

        switch (action) {
            // may need to update certain item properties like proficiency/equipped
            case "attack":
                let prof;
                if (game.settings.get(moduleName, "autoProficiency")) prof = true;
                else prof = await Dialog.confirm({ title: game.i18n.localize("DND5E.Proficiency"), content: game.i18n.localize(`${moduleName}.autoProficiency.content`), options: { top: event.clientY ?? null, left: window.innerWidth - 560, width: 250 } });

                if (prof === null) return interactor.deleteEmbeddedDocuments("Item", [interactorItem.id]);
                else await interactorItem.update({ proficiency: prof });

                await interactorItem.rollAttack({ event });
                break;
            case "damage":
                await interactorItem.rollDamage({ critical: event.altKey, event });
                break;
            case "ability":
                const ability = environmentItem.data.data.ability;
                interactor.rollAbilityTest(ability);
                break;
            case "save":
                const save = environmentItem.data.data.save.ability
                interactor.rollAbilitySave(save);
                break;
        }

        if (interactorItem) await interactor.deleteEmbeddedDocuments("Item", [interactorItem.id]);
    }

    // Environment Interaction
    static async interactWithEnvironment(environmentToken, event) {
        // TODO: dnd5e specific; create a helper function to handle different systems
        // Sort to mimic order of items on character sheet
        const items = [];
        for (const type of ["weapon", "abil", "save", "loot"]) {
            environmentToken.actor.items
                .filter(i => {
                    if (i.type === "consumable") {
                        return i.data.data.actionType === type;
                    }
                    else return i.type === type;
                })
                .sort((a, b) => (a.data.sort || 0 ) - (b.data.sort || 0))
                .forEach(i => items.push(i));
        }

        const content = await renderTemplate(`/modules/${moduleName}/templates/interaction-dialog.hbs`, { items });
        const buttons = {};
        if (game.user.isGM) buttons.openSheet = { label: game.i18n.localize(`${moduleName}.interactWithEnvironment.openCharacterSheet`), callback: () => environmentToken.actor.sheet.render(true) };
        const dialogOptions = {
            id: "ei-interaction-dialog",
            width: 270,
            top: event.data.originalEvent.clientY - 10,
            left: event.data.originalEvent.clientX + 50
        };
        const render = html => {
            html.on("click", `button.ei-flex-container`, async event => {
                const interactorToken = canvas.tokens.controlled[0];
                if (!interactorToken) return ui.notifications.warn(game.i18n.localize(`${moduleName}.interactWithEnvironment.selectTokenWarn`));

                const itemID = event.currentTarget.id;
                const item = environmentToken.actor.items.get(itemID);
                const [ownedItem] = await interactorToken.actor.createEmbeddedDocuments("Item", [item.toObject()]);

                Hooks.once("preCreateChatMessage", (card, data, options, userID) => {
                    const content = $(card.data.content);

                    if (["loot", "consumable"].includes(item.type)) {
                        content.find(`footer`).remove();
                        if (item.type === "loot") content.find(`div.card-buttons`).remove();
                    }

                    if (item.data.data.actionType === "abil") {
                        content.find(`div.card-buttons`).append(`<button data-action="ability">${CONFIG.DND5E.abilities[item.data.data.ability]} ${game.i18n.localize(`${moduleName}.interactWithEnvironment.Check`)}</button>`);
                    }

                    card.data.update({ content: content.prop("outerHTML") });
                });

                const chatCard = await interactorToken.actor.items.get(ownedItem.id).roll();
                chatCard.setFlag(moduleName, "useData", {
                    itemID,
                    environmentTokenID: environmentToken.id,
                    interactorTokenID: interactorToken.id,
                });

                if (ownedItem.data.flags.itemacro?.macro && game.modules.get("itemacro")?.active) ownedItem.executeMacro();

                await interactorToken.actor.deleteEmbeddedDocuments("Item", [ownedItem.id]);

                if (game.settings.get(moduleName, "closeDialog")) {
                    const appID = html.closest(`div.app`).data("appid");
                    ui.windows[appID].close();
                }

                if (item.type === "loot") {
                    const macroName = item.data.data.source;
                    const macro = game.macros.getName(macroName);

                    macro.execute({ actor: interactorToken.actor, token: interactorToken });
                }
            });
        };

        new Dialog({
            title: game.i18n.localize(`${moduleName}.interactWithEnvironment.title`),
            content,
            buttons,
            render
        }, dialogOptions).render(true);
    }

    // Hooks
    static registerHooks() {
        // Add checkbox to token config to flag token as environment token
        Hooks.on("renderTokenConfig", (app, html, appData) => {
            if (!game.user.isGM) return;

            const checked = app.object.getFlag(moduleName, "environmentToken") ? "checked" : "";
            const snippet = `
                <div class="form-group">
                    <label>${game.i18n.localize(`${moduleName}.tokenConfig.label`)}</label>
                    <input type="checkbox" name="flags.${moduleName}.environmentToken" data-dtype="Boolean" ${checked} />
                </div>
            `;
            html.find(`div[data-tab="character"]`).append(snippet);
            html.css("height", "auto");
        });
    }

}
