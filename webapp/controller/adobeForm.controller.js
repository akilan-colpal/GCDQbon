sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "adobeform/controller/HRValueHelpHandler.controller",
    "adobeform/controller/EmployeeValueHelpHandler.controller"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, Fragment, HRValueHelpHandler, EmployeeValueHelpHandler) {
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
            this.oValueHelpHandler = new HRValueHelpHandler(this);
            this.oEmployeeTreeHandler = new EmployeeValueHelpHandler(this); 
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var bIsHR = oUserDataModel.getProperty("/isHR"); 
            var bIsMgr = oUserDataModel.getProperty("/isMgr"); 

            if (bIsHR) {
                var sEmpId = oUserDataModel.getProperty("/userId");
                this.byId("hrEmployeeIdInput").setValue(sEmpId);
                this._loadDropdownData(sEmpId); 
                
            } else if (bIsMgr) {
                oViewModel.setProperty("/isGlobalIdVisible", true);
                this._preloadTreeData();     
                           
            } else {
                oViewModel.setProperty("/isGlobalIdVisible", false);

                var sEmpId = oUserDataModel.getProperty("/userId");
                var oEmpInput = this.byId("employeeIdInput"); 
                if (oEmpInput) {
                    oEmpInput.setValue(sEmpId);
                }
                
                this._loadDropdownData(sEmpId); 
            }
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
        // EMPLOYEE VALUE HELP DIALOG 
        // =======================================================
        onEmployeeTreeValueHelp: function (oEvent) {
            
            this.oEmployeeTreeHandler.openTreeDialog(oEvent, function(sSelectedId, oInputBox) {
                
                oInputBox.setValue(sSelectedId);
                
                this.byId("bonusYearInput").setSelectedKey("");
                this.byId("bonusQuarterInput").setSelectedKey("");
                this.getView().getModel().setProperty("/isQuarterEnabled", false);
                
                this._loadDropdownData(sSelectedId);

            }.bind(this));
        },

        // =======================================================
        // HR MULTI-INPUT VALUE HELP
        // =======================================================

        onHREmployeeValueHelp: function (oEvent) {
            
            var oConfig = {
                entitySet: "User",
                key: "userId",
                description: "lastName",
                parameters: {
                    "select": "userId,firstName,lastName"
                },
                columns: [
                    { label: "Employee ID", template: "userId" },
                    { label: "First Name", template: "firstName" },
                    { label: "Last Name", template: "lastName" }
                ],
                title: "Employees",
                aFilters: [], 
                aSorters: [] 
            };

            this.oValueHelpHandler.openValueHelpDialog(oEvent, oConfig, "mSuccessFactorsModel", function(aSelectedTokens, oInputBox) {
                
                if (aSelectedTokens && aSelectedTokens.length > 0) {
                    var sId = aSelectedTokens[0].getKey();
                    
                    oInputBox.setValue(sId);
                    
            this.byId("bonusYearInput").setSelectedKey("");
            this.byId("bonusQuarterInput").setSelectedKey("");
            this.getView().getModel().setProperty("/isQuarterEnabled", false);
            this._loadDropdownData(sId);                }

            }.bind(this)); 
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
            oSFModel.read("/cust_VarPayEmpHistData", {
                filters: aFilters,
                urlParameters: {
                    "fromDate": "1900-01-01",
                    "toDate":   "9999-12-31",
                    "$select": "cust_VarPayTemplateName",
                    "$orderby": "cust_VarPayTemplateName desc"
                },
                success: function (oData) {
                    
                    var aResults        = oData.results || [];
                    var aYears          = [];
                    var aParsedPeriods  = [];
                    var aTemplateItems  = [];
                    var oTemplateMap    = Object.create(null);
                    var oViewModel      = oView.getModel();

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

                    oViewModel.setProperty("/allPeriods", aParsedPeriods);
                    oViewModel.setProperty("/availableYears", aYears);
                    
                    aTemplateItems.sort(function (a, b) {
                        return a.templateName.localeCompare(b.templateName);
                    });
                    oViewModel.setProperty("/availableTemplates", aTemplateItems);

                    if (aParsedPeriods.length > 0) {
                        var oLatest = this._getLatestPeriod(aParsedPeriods);

                        if (oLatest) {
                            var aQuarters = [];
                            aParsedPeriods.forEach(function (item) {
                                if (item.bonusYear === oLatest.bonusYear &&
                                    !aQuarters.some(function (q) { return q.quarter === item.bonusQuarter; })) {
                                    aQuarters.push({ quarter: item.bonusQuarter });
                                }
                            });

                            aQuarters.sort(function (a, b) {
                                return a.quarter.localeCompare(b.quarter);
                            });

                            oViewModel.setProperty("/availableQuarters", aQuarters);
                            oViewModel.setProperty("/isQuarterEnabled", aQuarters.length > 0);

                            this.byId("bonusYearInput").setSelectedKey(oLatest.bonusYear);
                            this.byId("bonusQuarterInput").setSelectedKey(oLatest.bonusQuarter);
                            
                        }
                    } else {
                        
                        oViewModel.setProperty("/availableQuarters", []);
                        oViewModel.setProperty("/isQuarterEnabled", false);
                        this.byId("bonusYearInput").setSelectedKey("");
                        this.byId("bonusQuarterInput").setSelectedKey("");
                        oView.setBusy(false); 
                    }

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
            var sGlobalId = "";
            var sHrId = this.byId("hrEmployeeIdInput") && this.byId("hrEmployeeIdInput").getValue();
            var sTreeId = this.byId("employeeIdInput") && this.byId("employeeIdInput").getValue();

            if (sHrId) {
                sGlobalId = sHrId;
            } else if (sTreeId) {
                sGlobalId = sTreeId;
            }           
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
        _getLatestPeriod: function (aParsedPeriods) {
            var oQuarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
            var oLatest = null;

            aParsedPeriods.forEach(function (oPeriod) {
                if (!oLatest) {
                    oLatest = oPeriod;
                    return;
                }

                if (oPeriod.bonusYear > oLatest.bonusYear) {
                    oLatest = oPeriod;
                } else if (oPeriod.bonusYear === oLatest.bonusYear) {
                    if ((oQuarterOrder[oPeriod.bonusQuarter] || 0) >
                        (oQuarterOrder[oLatest.bonusQuarter] || 0)) {
                        oLatest = oPeriod;
                    }
                }
            });

            return oLatest;
        },
        onGeneratePress: function () {
            var oView = this.getView();
            var sGlobalId = "";
            var sHrId = this.byId("hrEmployeeIdInput") && this.byId("hrEmployeeIdInput").getValue();
            var sTreeId = this.byId("employeeIdInput") && this.byId("employeeIdInput").getValue();

            if (sHrId) {
                sGlobalId = sHrId;
            } else if (sTreeId) {
                sGlobalId = sTreeId;
            }            
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