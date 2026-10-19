sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/SearchField",
    "sap/m/Label",
    "sap/ui/table/Column",
    "sap/m/Text"
], function (UI5Object, Fragment, Filter, FilterOperator, SearchField, Label, Column, Text) {
    "use strict";

    return UI5Object.extend("adobeform.controller.HRValueHelpHandler.controller", { 

        constructor: function (oParentController) {
            this.oParentController = oParentController;
            this.oView = oParentController.getView();
            this.debouncedFilterBarSearch = this.debounce(this.onFilterBarSearch, 100);
        },

        debounce: function (func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        openValueHelpDialog: function (oEvent, oConfig, sModelName, fnSuccessCallback) {
            this.oCurrentInput = oEvent.getSource();
            this.oValueHelpConfig = oConfig;
            this.sModelName = sModelName;
            this.fnSuccessCallback = fnSuccessCallback; 

            Fragment.load({
                id: this.oView.getId(),
                name: "adobeform.fragment.HRSelectValueHelp", 
                controller: this 
            }).then(function (oDialog) {
                this.oValueHelpDialog = oDialog;
                this.oView.addDependent(this.oValueHelpDialog);

                this.oValueHelpDialog.setTitle(oConfig.title);
                this.oValueHelpDialog.setKey(oConfig.key);
                this.oValueHelpDialog.setIncludeRangeOperations(["EQ", "Contains", "LT", "LE", "GT", "GE"], "string");
                this.oValueHelpDialog.setExcludeRangeOperations(["EQ"], "string");
                this.oValueHelpDialog.setRangeKeyFields([{ label: oConfig.description, key: oConfig.key, type: "string" }]);

                var oFilterBar = Fragment.byId(this.oView.getId(), "valueHelpFilterBar");
                if (oFilterBar) {
                    oFilterBar.setBasicSearch(new SearchField({ liveChange: this.debouncedFilterBarSearch.bind(this) }));
                }

                this.oValueHelpDialog.getTableAsync().then(function (oTable) {
                    oTable.setModel(this.oParentController.getOwnerComponent().getModel(sModelName));
                    
                    oTable.bindAggregation("rows", {
                        path: "/" + oConfig.entitySet,
                        filters: oConfig.aFilters,
                        sorter: oConfig.aSorters,
                        parameters: oConfig.parameters,
                        events: {
                            dataReceived: function () {
                                oTable.setBusy(false);
                                this.oValueHelpDialog.update();
                            }.bind(this)
                        }
                    });

                    oTable.removeAllColumns();
                    oConfig.columns.forEach(function (col) {
                        oTable.addColumn(new Column({
                            label: new Label({ text: col.label }),
                            template: new Text({ wrapping: false, text: `{${col.template}}` })
                        }));
                    });
                    this.oValueHelpDialog.update();
                }.bind(this));

                if (this.oCurrentInput.getTokens) {
                    this.oValueHelpDialog.setTokens(this.oCurrentInput.getTokens());
                }

                this.oValueHelpDialog.open();
            }.bind(this));
        },

        onFilterBarSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            var aFilters = this.oValueHelpConfig.aFilters ? this.oValueHelpConfig.aFilters.slice(0) : [];

            if (sValue && sValue.trim() !== "") {
                var aSearchWords = sValue.trim().split(/\s+/); 
                var aWordFilters = [];

                var sOperator = (aSearchWords.length === 1) ? FilterOperator.StartsWith : FilterOperator.Contains;

                aSearchWords.forEach(function (sWord) {
                    
                    var aColumnFilters = this.oValueHelpConfig.columns.map(function (col) {
                        return new Filter({
                            path: col.template,
                            operator: sOperator,
                            value1: sWord,
                            caseSensitive: false
                        });
                    });
                    
                    aWordFilters.push(new Filter({ filters: aColumnFilters, and: false }));
                    
                }.bind(this));

                aFilters.push(new Filter({ filters: aWordFilters, and: true }));
            }

            this.oValueHelpDialog.getTableAsync().then(function (oTable) {
                if (oTable.getBinding("rows")) {
                    oTable.getBinding("rows").filter(new Filter({ filters: aFilters, and: true }));
                }
            });
        },
        onValueHelpOkPress: function (oEvent) {
            var aTokens = oEvent.getParameter("tokens");
            
            this.oValueHelpDialog.close();

            if (this.fnSuccessCallback) {
                this.fnSuccessCallback(aTokens, this.oCurrentInput);
            }
        },

        onValueHelpCancelPress: function () {
            this.oValueHelpDialog.close();
        },

        onValueHelpAfterClose: function () {
            this.oValueHelpDialog.destroy();
        }
    });
});