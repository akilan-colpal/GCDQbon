sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/base/i18n/Localization",
    "require"
], function (Controller, Localization, require) {
    "use strict";

    return Controller.extend("adobeform.controller.App", {
        onInit: function () {
            this.byId("logo").setSrc(require.toUrl("adobeform/image/ColPal_Icon.svg"));
        },

        pressLogo: function () {
            this.getOwnerComponent().getRouter().navTo("RouteStart");
        },

        onLanguageChange: function (oEvent) {
            var sLanguage = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent().getModel("appSettings").setProperty("/language", sLanguage);
            Localization.setLanguage(sLanguage);
        }
    });
});
