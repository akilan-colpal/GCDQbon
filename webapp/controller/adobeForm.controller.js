sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, Fragment) {
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
                summaryRowCount: 1,
                
                isGlobalIdVisible: false,
                treeHierarchy: []
            });
            this.getView().setModel(oViewModel); 
            this.byId("resultsAccordion").bindElement("/data");
            
            this.getView().setBusy(true);
            this._preloadTreeData();
        },

        formatTreeTitle: function (sFirstName, sLastName, sEmpId) {
            return (sFirstName || "") + " " + (sLastName || "") + " (" + (sEmpId || "") + ")";
        },

        // =======================================================
        _fetchSFData: function (sPath, oUrlParams) {
            var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");
            return new Promise(function (resolve, reject) {
                oSFModel.read(sPath, {
                    urlParameters: oUrlParams,
                    success: function (oData) { resolve(oData); },
                    error: function (oError) { reject(oError); }
                });
            });
        },

        // =======================================================
        // TREE DATA LOAD 
        // =======================================================
        _preloadTreeData: async function () {
            var oView = this.getView();
            var oViewModel = oView.getModel();
            
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var sRootEmpId = oUserDataModel.getProperty("/userId"); 
            
            this.byId("employeeIdInput").setValue(sRootEmpId);

             try {
                var oUserData = await this._fetchSFData("/User('" + sRootEmpId + "')", {
                    "$select": "userId,firstName,lastName,directReports/userId,directReports/firstName,directReports/lastName,directReports/directReports/userId,directReports/directReports/firstName,directReports/directReports/lastName,directReports/directReports/directReports/userId,directReports/directReports/directReports/firstName,directReports/directReports/directReports/lastName", 
                    "$expand": "directReports,directReports/directReports,directReports/directReports/directReports"
                });

                var aDirectReports = (oUserData.directReports && oUserData.directReports.results) ? oUserData.directReports.results : [];

                var oUserNode = {
                    empid: oUserData.userId,
                    firstname: oUserData.firstName,
                    lastname: oUserData.lastName,
                    nodes: []
                };

                if (aDirectReports.length > 0) {
                    oUserNode.nodes = aDirectReports.map(function(dr) {
                        
                        var aSubReports = (dr.directReports && dr.directReports.results) ? dr.directReports.results : [];
                        
                        return {
                            empid: dr.userId,
                            firstname: dr.firstName,
                            lastname: dr.lastName,
                            nodes: aSubReports.map(function(subDr) {
                                
                                var aSubSubReports = (subDr.directReports && subDr.directReports.results) ? subDr.directReports.results : [];

                                return {
                                    empid: subDr.userId,
                                    firstname: subDr.firstName,
                                    lastname: subDr.lastName,
                                    nodes: aSubSubReports.map(function(subSubDr) {
                                        return {
                                            empid: subSubDr.userId,
                                            firstname: subSubDr.firstName,
                                            lastname: subSubDr.lastName,
                                            nodes: [] 
                                        };
                                    })
                                };
                            })
                        };
                    });
                }

                var aTree = [oUserNode];

         
                oViewModel.setProperty("/isGlobalIdVisible", true);
                oViewModel.setProperty("/treeHierarchy", aTree);
                this._loadDropdownData(sRootEmpId);

            

            } catch (oError) {
                console.error("Tree Load Error:", oError);
                MessageBox.error("Failed to load employee hierarchy.");
            } finally {
                oView.setBusy(false);
            }
        },

        // =======================================================
        // VALUE HELP DIALOG 
        // =======================================================
        onEmployeeTreeValueHelp: function () {
            var oView = this.getView();
            if (!this._pTreeDialog) {
                this._pTreeDialog = Fragment.load({
                    id: oView.getId(),
                    name: "adobeform.fragment.EmployeeTreeValueHelp", 
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.setModel(oView.getModel(), "treeModel");
                    return oDialog;
                });
            }
            this._pTreeDialog.then(function(oDialog) {
                oDialog.open();
            });
        },

        onCloseTreeDialog: function () {
            this.byId("treeDialog").close();
        },

        onTreeItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("treeModel");

            var sSelectedId = oContext.getProperty("empid"); 
            
            var oGlobalIdInput = this.byId("employeeIdInput");
            oGlobalIdInput.setValue(sSelectedId);
            
            this.byId("treeDialog").close();
            
            this.byId("bonusYearInput").setSelectedKey("");
            this.byId("bonusQuarterInput").setSelectedKey("");
            this.getView().getModel().setProperty("/isQuarterEnabled", false);
            
            this._loadDropdownData(sSelectedId);
        },

        // =======================================================
        // HR MULTI-INPUT VALUE HELP
        // =======================================================
        onHREmployeeValueHelp: function () {
            var oView = this.getView();
            
            if (!this._pEmployeeDialog) {
                this._pEmployeeDialog = Fragment.load({
                    id: oView.getId(),
                    name: "adobeform.fragment.EmployeeSelectValueHelp", 
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
       
            this._pEmployeeDialog.then(function(oDialog) {
                oDialog.getBinding("items").filter([]);
                oDialog.open();
            });
        },

        onHREmployeeSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oBinding = oEvent.getSource().getBinding("items");
            
            if (sValue) {
                var oFilter = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("userId", sap.ui.model.FilterOperator.Contains, sValue),
                        new sap.ui.model.Filter("firstName", sap.ui.model.FilterOperator.Contains, sValue),
                        new sap.ui.model.Filter("lastName", sap.ui.model.FilterOperator.Contains, sValue)
                    ],
                    and: false
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onHREmployeeConfirm: function (oEvent) {
            var aSelectedContexts = oEvent.getParameter("selectedContexts");
            
            if (aSelectedContexts && aSelectedContexts.length > 0) {
                var oContext = aSelectedContexts[0];
                var sId = oContext.getProperty("userId");

                var oInput = this.byId("hrEmployeeIdInput"); 
                oInput.setValue(sId); 
                this.byId("bonusYearInput").setSelectedKey("");
                this.byId("bonusQuarterInput").setSelectedKey("");
                this.getView().getModel().setProperty("/isQuarterEnabled", false);
                
                this._loadDropdownData(sId);
            }
        },


        // =======================================================
        // DROPDOWNS & DATA FETCHING
        // =======================================================

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
            var sGlobalId = this.byId("hrEmployeeIdInput").getValue() || this.byId("employeeIdInput").getValue();
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
            var sGlobalId = this.byId("employeeIdInput").getValue() ||  this.byId("hrEmployeeIdInput").getValue();
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
                        sap.m.MessageBox.error("No PDF data returned from the backend.");
                    }
                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false);
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
        }
    });
});