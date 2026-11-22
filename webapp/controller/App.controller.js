sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/base/i18n/Localization",
    "sap/ui/model/json/JSONModel"
], function (Controller, Localization, JSONModel) {
    "use strict";

    return Controller.extend("adobeform.controller.App", {

        onInit: function () {
            var sLanguage = (Localization.getLanguage() || "en").toLowerCase();
            var sAppLang = sLanguage.indexOf("es") === 0 ? "es" : "en";

            this.getOwnerComponent().setModel(new JSONModel({
                language: sAppLang
            }), "appSettings");
        },

        pressLogo: function () {
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onLanguageChange: function (oEvent) {
            var sSelectedLang = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent().getModel("appSettings").setProperty("/language", sSelectedLang);
            Localization.setLanguage(sSelectedLang);
        }
    });
});
