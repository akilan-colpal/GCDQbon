sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "adobeform/model/journey"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, journey) {
    "use strict";

    return Controller.extend("adobeform.controller.Start", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ users: [] }), "hrUsers");
            this.getView().setModel(new JSONModel({ nodes: [] }), "treeFilter");
        },

        onYearChange: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (!oItem) {
                return;
            }
            var oComponent = this.getOwnerComponent();
            oComponent.getModel("journey").setProperty("/year", oItem.getKey());
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            journey.loadQuarterStatements(oComponent).catch(function () {
                MessageBox.error(oBundle.getText("PERIODS_FAILED"));
            });
        },

        onContinue: function () {
            this.getOwnerComponent().getRouter().navTo("RouteQuarters");
        },

        onGlobalIdChange: function () {
            var sLabel = this.getOwnerComponent().getModel("journey").getProperty("/selectedEmployeeLabel");
            this.byId("employeeIdInput").setValue(sLabel);
        },

        onEmployeeValueHelp: function () {
            var sRole = this.getOwnerComponent().getModel("journey").getProperty("/role");
            if (sRole === "hr") {
                this.onOpenHrDialog();
            }
            if (sRole === "manager") {
                this.onOpenTreeDialog();
            }
        },

        onOpenHrDialog: function () {
            if (!this._pHrDialog) {
                this._pHrDialog = this.loadFragment({
                    name: "adobeform.fragment.HrEmployeeDialog"
                });
            }
            this._pHrDialog.then(function (oDialog) {
                oDialog.open();
                this.onHrSearch();
            }.bind(this));
        },

        onHrSearch: function (oEvent) {
            var sQuery = "";
            if (oEvent && oEvent.getParameter) {
                sQuery = oEvent.getParameter("value") || "";
            }
            clearTimeout(this._iHrSearch);
            this._iHrSearch = setTimeout(function () {
                var aFilters = [];
                var sText = sQuery.trim();
                if (sText) {
                    var aWords = sText.split(/\s+/);
                    var sOperator = aWords.length === 1 ? FilterOperator.StartsWith : FilterOperator.Contains;
                    var aWordFilters = [];
                    var i;
                    for (i = 0; i < aWords.length; i++) {
                        aWordFilters.push(new Filter({
                            filters: [
                                new Filter({ path: "userId", operator: sOperator, value1: aWords[i], caseSensitive: false }),
                                new Filter({ path: "firstName", operator: sOperator, value1: aWords[i], caseSensitive: false }),
                                new Filter({ path: "lastName", operator: sOperator, value1: aWords[i], caseSensitive: false })
                            ],
                            and: false
                        }));
                    }
                    aFilters.push(new Filter({ filters: aWordFilters, and: true }));
                }

                var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");
                var oBundle = this.getView().getModel("i18n").getResourceBundle();
                this.byId("hrEmployeeDialog").setBusy(true);
                oSFModel.read("/User", {
                    filters: aFilters,
                    urlParameters: {
                        "$select": "userId,firstName,lastName",
                        "$top": 40
                    },
                    success: function (oData) {
                        this.byId("hrEmployeeDialog").setBusy(false);
                        var aUsers = [];
                        var aResults = oData.results || [];
                        var n;
                        for (n = 0; n < aResults.length; n++) {
                            var oUser = aResults[n];
                            var sName = ((oUser.firstName || "") + " " + (oUser.lastName || "")).trim();
                            aUsers.push({
                                userId: oUser.userId,
                                label: sName || oUser.userId
                            });
                        }
                        this.getView().getModel("hrUsers").setProperty("/users", aUsers);
                    }.bind(this),
                    error: function () {
                        this.byId("hrEmployeeDialog").setBusy(false);
                        this.getView().getModel("hrUsers").setProperty("/users", []);
                        MessageBox.error(oBundle.getText("SEARCH_FAILED"));
                    }.bind(this)
                });
            }.bind(this), 250);
        },

        onHrConfirm: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (!oItem) {
                return;
            }
            var oUser = oItem.getBindingContext("hrUsers").getObject();
            var oComponent = this.getOwnerComponent();
            var oJourneyModel = oComponent.getModel("journey");
            oJourneyModel.setProperty("/selectedEmployeeId", oUser.userId);
            oJourneyModel.setProperty("/selectedEmployeeLabel", oUser.label);
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            journey.loadPeriods(oComponent, oUser.userId).catch(function () {
                MessageBox.error(oBundle.getText("PERIODS_FAILED"));
            });
        },

        onOpenTreeDialog: function () {
            if (!this._pTreeDialog) {
                this._pTreeDialog = this.loadFragment({
                    name: "adobeform.fragment.EmployeeTreeValueHelp"
                });
            }
            var aTree = this.getOwnerComponent().getModel("journey").getProperty("/orgTree") || [];
            this.getView().getModel("treeFilter").setProperty("/nodes", aTree);
            this._pTreeDialog.then(function (oDialog) {
                oDialog.open();
                var oTree = this.byId("orgTree");
                if (oTree) {
                    oTree.expandToLevel(1);
                }
            }.bind(this));
        },

        onManagerTreeSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("query");
            }
            sQuery = (sQuery || "").trim();
            var aTree = this.getOwnerComponent().getModel("journey").getProperty("/orgTree") || [];
            var aFiltered = aTree;

            if (sQuery) {
                var aWords = sQuery.split(/\s+/);
                var walk = function (aNodes) {
                    var aOut = [];
                    var i;
                    for (i = 0; i < aNodes.length; i++) {
                        var oNode = aNodes[i];
                        var aKids = walk(oNode.nodes || []);
                        var sHay = (oNode.empid + " " + oNode.firstname + " " + oNode.lastname).toLowerCase();
                        var bMatch = true;
                        var w;
                        for (w = 0; w < aWords.length; w++) {
                            if (sHay.indexOf(aWords[w].toLowerCase()) === -1) {
                                bMatch = false;
                            }
                        }
                        if (bMatch || aKids.length) {
                            aOut.push({
                                empid: oNode.empid,
                                firstname: oNode.firstname,
                                lastname: oNode.lastname,
                                title: oNode.title,
                                nodes: aKids
                            });
                        }
                    }
                    return aOut;
                };
                aFiltered = walk(aTree);
            }

            this.getView().getModel("treeFilter").setProperty("/nodes", aFiltered);
            var oTree = this.byId("orgTree");
            if (!oTree) {
                return;
            }
            setTimeout(function () {
                if (sQuery) {
                    oTree.expandToLevel(99);
                } else {
                    oTree.collapseAll();
                    oTree.expandToLevel(1);
                }
            }, 0);
        },

        onTreeItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oNode = oItem.getBindingContext("treeFilter").getObject();
            var sName = ((oNode.firstname || "") + " " + (oNode.lastname || "")).trim();
            var oComponent = this.getOwnerComponent();
            var oJourneyModel = oComponent.getModel("journey");
            oJourneyModel.setProperty("/selectedEmployeeId", oNode.empid);
            oJourneyModel.setProperty("/selectedEmployeeLabel", sName || oNode.empid);
            this.onCloseTreeDialog();
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            journey.loadPeriods(oComponent, oNode.empid).catch(function () {
                MessageBox.error(oBundle.getText("PERIODS_FAILED"));
            });
        },

        onCloseTreeDialog: function () {
            var oDialog = this.byId("treeDialog");
            if (oDialog) {
                oDialog.close();
            }
        }
    });
});
