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
                if (oTree) {
                    oTree.removeSelections();
                }
                oDialog.open();
            }.bind(this));
        },

        onTreeItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("treeModel");
            var sSelectedId = oContext.getProperty("empid");
            var sLabel = this.formatTreeTitle(
                oContext.getProperty("firstname"),
                oContext.getProperty("lastname"),
                sSelectedId
            );

            this.onCloseTreeDialog();

            if (this.fnSuccessCallback) {
                this.fnSuccessCallback(sSelectedId, this.oCurrentInput, sLabel);
            }
        },

        onCloseTreeDialog: function () {
            if (this._pTreeDialog) {
                this._pTreeDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        formatTreeTitle: function (sFirst, sLast, sId) {
            if (sFirst && sLast && sId) {
                return sFirst + " " + sLast + " (" + sId + ")";
            }
            return (sFirst || "") + " " + (sLast || "");
        },

        onManagerTreeSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            if (sValue === undefined) {
                sValue = oEvent.getParameter("query");
            }

            var oTree = Fragment.byId(this.oView.getId(), "orgTree");
            var oBinding = oTree.getBinding("items");

            if (sValue) {
                var oFilter = new Filter({
                    filters: [
                        new Filter("empid", FilterOperator.Contains, sValue),
                        new Filter("firstname", FilterOperator.Contains, sValue),
                        new Filter("lastname", FilterOperator.Contains, sValue)
                    ],
                    and: false
                });
                oBinding.filter([oFilter]);
                oTree.expandToLevel(99);
            } else {
                oBinding.filter([]);
                oTree.collapseAll();
                oTree.expandToLevel(1);
            }
        },

        onTreeToggleOpenState: function () {
        }
    });
});
