sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("adobeform.controller.App", {
        pressLogo: function(){
          this.getOwnerComponent().getRouter().navTo("RouteadobeForm");
      },
  });
});

