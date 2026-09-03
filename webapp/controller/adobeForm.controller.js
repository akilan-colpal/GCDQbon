sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("adobeform.controller.adobeForm", {

        onInit: function () {
            var oViewModel = new JSONModel({
                data: {},
                allPeriods: [], 
                availableYears: [],
                availableQuarters: [],
                isQuarterEnabled: false,
                kpiRowCount: 1, 
                summaryRowCount: 1
            });
            this.getView().setModel(oViewModel); 
            
            this.byId("resultsAccordion").bindElement("/data");
        },

        onGlobalIdChange: function (oEvent) {
            var sGlobalId = oEvent.getParameter("value");
            
            if (sGlobalId) {
                this.byId("bonusYearInput").setSelectedKey("");
                this.byId("bonusQuarterInput").setSelectedKey("");
                this.getView().getModel().setProperty("/isQuarterEnabled", false);
                this._loadDropdownData(sGlobalId);
            }
        },

_loadDropdownData: function (sEmployeeId) {
    var oView = this.getView();
    var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");

    var aFilters = [
        new Filter("externalCode", FilterOperator.EQ, sEmployeeId)
    ];

    oView.setBusy(true);

    oSFModel.read("/cust_VarPayEmpHistData", {
        filters: aFilters,
        urlParameters: {
            fromDate: "1900-01-01",     
            toDate:   "9999-12-31",     

            "$orderby": "cust_VarPayTemplateName desc"
        },

        success: function (oData) {
            oView.setBusy(false);

            var aResults        = oData.results || [];
            var aYears          = [];
            var aParsedPeriods  = [];
            var aTemplateItems  = []; 
            var oTemplateMap    = Object.create(null);

            aResults.forEach(function (item) {
                var sTemplateName = item.cust_VarPayTemplateName;

                if (sTemplateName) {
                    if (!oTemplateMap[sTemplateName]) {
                        oTemplateMap[sTemplateName] = true;
                        aTemplateItems.push({
                            templateName: sTemplateName
                        });
                    }
                    var aMatch = sTemplateName.match(/(\d{4})\s+(Q[1-4])/i);
                    if (aMatch) {
                        var sYear    = aMatch[1];
                        var sQuarter = aMatch[2].toUpperCase();

                        aParsedPeriods.push({
                            bonusYear:    sYear,
                            bonusQuarter: sQuarter,
                            templateName: sTemplateName
                        });

                        if (!aYears.some(function (y) { return y.year === sYear; })) {
                            aYears.push({ year: sYear });
                        }
                    }
                }
            });

            aYears.sort(function (a, b) {
                return a.year.localeCompare(b.year);
            });
            oView.getModel().setProperty("/allPeriods", aParsedPeriods);
            oView.getModel().setProperty("/availableYears", aYears);
            oView.getModel().setProperty("/availableQuarters", []);
            aTemplateItems.sort(function (a, b) {
                return a.templateName.localeCompare(b.templateName);
            });
            oView.getModel().setProperty("/availableTemplates", aTemplateItems);
        }.bind(this),

        error: function (oError) {
            oView.setBusy(false);

        }.bind(this)
    });
},

        onYearChange: function (oEvent) {
            var oView = this.getView();
            var sSelectedYear = oEvent.getParameter("selectedItem").getKey();
            var aAllPeriods = oView.getModel().getProperty("/allPeriods") || [];
            var aQuarters = [];

            aAllPeriods.forEach(function(item) {
                if (item.bonusYear === sSelectedYear) {
                    
                    var isDuplicate = false; 
                    
                    for (var j = 0; j < aQuarters.length; j++) {
                        if (aQuarters[j].quarter === item.bonusQuarter) {
                            isDuplicate = true; 
                            break; 
                        }
                    }
                    if (isDuplicate === false) {
                        aQuarters.push({ quarter: item.bonusQuarter });
                    }
                }
            });
            aQuarters.sort(function(a, b) { return a.quarter.localeCompare(b.quarter); });

            oView.getModel().setProperty("/availableQuarters", aQuarters);
            this.byId("bonusQuarterInput").setSelectedKey("");
            oView.getModel().setProperty("/isQuarterEnabled", aQuarters.length > 0); 
        },

        onSearchPress: function () {
            var oView = this.getView();
            var sGlobalId = this.byId("globalIdInput").getValue();
            var sYear = this.byId("bonusYearInput").getSelectedKey();
            var sQuarter = this.byId("bonusQuarterInput").getSelectedKey();

            var aFilters = [
                new Filter("global_id", FilterOperator.EQ, sGlobalId),
                new Filter("bonusYear", FilterOperator.EQ, sYear),
                new Filter("bonusQuarter", FilterOperator.EQ, sQuarter)
            ];

            var oODataModel = this.getOwnerComponent().getModel();
            oView.setBusy(true);
            oODataModel.read("/ZI_QBON_DD", {
                filters: aFilters,
                urlParameters: {
                    "$expand": "to_KPIs,to_qSum" 
                },
                success: function (oData) {
                    oView.setBusy(false);
                    
                    if (oData.results && oData.results.length > 0) {
                        var oRecord = oData.results[0];
                        
                        if (oRecord.to_KPIs && oRecord.to_KPIs.results) {
                            oRecord.to_KPIs = oRecord.to_KPIs.results;
                        }
                        if (oRecord.to_qSum && oRecord.to_qSum.results) {
                            oRecord.to_qSum = oRecord.to_qSum.results;
                        }

                        var iKpiLength = oRecord.to_KPIs ? oRecord.to_KPIs.length : 1;
                        var iSumLength = oRecord.to_qSum ? oRecord.to_qSum.length : 1;
                        
                        oView.getModel().setProperty("/kpiRowCount", iKpiLength || 1);
                        oView.getModel().setProperty("/summaryRowCount", iSumLength || 1);
                        
                        oView.getModel().setProperty("/data", oRecord);
                        MessageToast.show("Data loaded successfully.");
                        this.byId("generatePdfBtn").setVisible(true);
                    } else {
                        oView.getModel().setProperty("/data", {});
                        oView.getModel().setProperty("/kpiRowCount", 1);
                        oView.getModel().setProperty("/summaryRowCount", 1);
                        this.byId("generatePdfBtn").setVisible(false);
                        MessageBox.information("No records found for the selected criteria.");
                    }
                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false);
                    MessageBox.error("Failed to fetch data from the backend.");
                }
            });
        },

    onGeneratePress: function () {
            var oView = this.getView();
            var sGlobalId = this.byId("globalIdInput").getValue();
            var sYear = this.byId("bonusYearInput").getSelectedKey();
            var sQuarter = this.byId("bonusQuarterInput").getSelectedKey();

            if (!sGlobalId || !sYear || !sQuarter) {
                sap.m.MessageBox.error("Missing search criteria to generate PDF.");
                return;
            }

            var aFilters = [
                new sap.ui.model.Filter("global_id", sap.ui.model.FilterOperator.EQ, sGlobalId),
                new sap.ui.model.Filter("bonusYear", sap.ui.model.FilterOperator.EQ, sYear),
                new sap.ui.model.Filter("bonusQuarter", sap.ui.model.FilterOperator.EQ, sQuarter),
                new sap.ui.model.Filter("generatePdfRequest", sap.ui.model.FilterOperator.EQ, "Y")
            ];

            var oODataModel = this.getOwnerComponent().getModel();
            
            oView.setBusy(true);
            oODataModel.read("/ZI_QBON_DD", {
                filters: aFilters,
                success: function (oData) {
                    oView.setBusy(false);
                    
                    if (oData.results && oData.results.length > 0 && oData.results[0].PdfContent) {
                        try {
                            var sBase64 = oData.results[0].PdfContent;
                            
                            var sCleanBase64 = sBase64.replace(/\s/g, '');

                            var sBinaryString = window.atob(sCleanBase64);
                            var iBinaryLen = sBinaryString.length;
                            var aBytes = new Uint8Array(iBinaryLen);
                            
                            for (var i = 0; i < iBinaryLen; i++) {
                                aBytes[i] = sBinaryString.charCodeAt(i);
                            }

                            var oBlob = new Blob([aBytes], { type: "application/pdf" });
                            var sBlobUrl = URL.createObjectURL(oBlob);
                            var oNewTab = window.open("", "_blank");
                            oNewTab.location.href = sBlobUrl;

                        } catch (e) {
                            sap.m.MessageBox.error("An error occurred while generating the PDF file locally.");
                        }
                    } else {
                        oNewTab.close(); 
                        sap.m.MessageBox.error("No PDF data returned from the backend.");
                    }
                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false);
                    if (oNewTab) {
                        oNewTab.close();
                    }
                    sap.m.MessageBox.error("Failed to fetch the PDF from the backend.");
                }
            });
        },

        formatCleanNumber: function (sValue) {
            if (!sValue) {
                return ""; 
            }
            var fValue = parseFloat(sValue);
            if (isNaN(fValue)) {
                return sValue; 
            }
            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        },

    });
});