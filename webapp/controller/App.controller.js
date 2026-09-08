sap.ui.define([
  "sap/ui/core/mvc/Controller",
   "sap/ui/core/Configuration"
], (BaseController) => {
  "use strict";

  return BaseController.extend("adobeform.controller.App", {
        pressLogo: function(){
          this.getOwnerComponent().getRouter().navTo("RouteadobeForm");
      },
      onLanguageChange: function (oEvent) {
        var sSelectedLang = oEvent.getParameter("selectedItem").getKey();
        sap.ui.getCore().getConfiguration().setLanguage(sSelectedLang);
      }
  });
});

