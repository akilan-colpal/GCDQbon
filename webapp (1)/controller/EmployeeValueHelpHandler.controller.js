sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (UI5Object, Fragment, Filter, FilterOperator) {
    "use strict";

    return UI5Object.extend("adobeform.controller.EmployeeValueHelpHandler.controller", {

        constructor: function (oParentController) {
            this.oParentController = oParentController;
            this.oView = oParentController.getView();
        },

        openTreeDialog: function (oEvent, fnSuccessCallback) {
            this.oCurrentInput = oEvent.getSource();
            this.fnSuccessCallback = fnSuccessCallback;

            if (!this._pTreeDialog) {
                this._pTreeDialog = Fragment.load({
                    id: this.oView.getId(),
                    name: "adobeform.fragment.EmployeeTreeValueHelp", 
                    controller: this 
                }).then(function (oDialog) {
                    this.oView.addDependent(oDialog);
                    
                   
                    oDialog.setModel(this.oView.getModel(), "treeModel");
                    
                    return oDialog;
                }.bind(this));
            }

            this._pTreeDialog.then(function (oDialog) {
              
                var oTree = Fragment.byId(this.oView.getId(), "orgTree");
                if (oTree) { oTree.removeSelections(); }
                
                oDialog.open();
            }.bind(this));
        },

        onTreeItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("treeModel");
            
            var sSelectedId = oContext.getProperty("empid");

            this.onCloseTreeDialog();

            if (this.fnSuccessCallback) {
                this.fnSuccessCallback(sSelectedId, this.oCurrentInput);
            }
        },

        onCloseTreeDialog: function () {
            if (this._pTreeDialog) {
                this._pTreeDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        // XML Formatter for the Tree items
        formatTreeTitle: function (sFirst, sLast, sId, bIsDummy) {
            if (sFirst && sLast && sId) return sFirst + " " + sLast + " (" + sId + ")";
            return sFirst + " " + sLast; 
        },

        onManagerTreeSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            if (sValue === undefined) {
                sValue = oEvent.getParameter("query");
            }

            var oTree = sap.ui.core.Fragment.byId(this.oView.getId(), "orgTree");
            var oBinding = oTree.getBinding("items");
            var aWords = (sValue || "").trim().split(/\s+/).filter(Boolean);

            if (aWords.length) {
                var aWordFilters = aWords.map(function (sWord) {
                    return new Filter({
                        filters: [
                            new Filter({ path: "empid", operator: FilterOperator.Contains, value1: sWord, caseSensitive: false }),
                            new Filter({ path: "firstname", operator: FilterOperator.Contains, value1: sWord, caseSensitive: false }),
                            new Filter({ path: "lastname", operator: FilterOperator.Contains, value1: sWord, caseSensitive: false })
                        ],
                        and: false
                    });
                });
                oBinding.filter([new Filter({ filters: aWordFilters, and: true })]);
                oTree.expandToLevel(99);
            } else {
                oBinding.filter([]);
                oTree.collapseAll();
                oTree.expandToLevel(1);
            }
        },

        onTreeToggleOpenState: function (oEvent) {
        }
    });
});