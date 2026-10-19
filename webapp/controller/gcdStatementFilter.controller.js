sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/core/format/DateFormat",
    "adobeform/controller/HRValueHelpHandler.controller",
    "adobeform/controller/EmployeeValueHelpHandler.controller"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, Fragment, DateFormat, HRValueHelpHandler, EmployeeValueHelpHandler) {
    "use strict";

    return Controller.extend("adobeform.controller.gcdStatementFilter", { 

        onInit: function () {
            var oViewModel = new JSONModel({
                data: {},
                allPeriods: [], 
                availableYears: [],
                availableQuarters: [],
                isQuarterEnabled: false,
                isSearchEnabled: false,
                kpiRowCount: 1, 
                summaryRowCount: 1,       
                isGlobalIdVisible: false,
                treeHierarchy: [],
                isPdfButtonVisible: false,
                startup: {
                    ytdAmount: "",
                    currency: "MXP",
                    periods: [],
                    periodsExpanded: true
                },
                searchCriteria: {
                    globalId: "",
                    year: "",
                    quarter: ""
                },
                ui: {
                    quarterProgressChart: []
                }
            });
            this.getView().setModel(oViewModel); 
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
        // SUCCESSFACTORS HELPERS
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
                this._updateSearchEnabled();
                this._loadDropdownData(sGlobalId);
            } else {
                this._updateSearchEnabled();
            }
        },

        // =======================================================
        // LOAD DROPDOWNS
        // =======================================================
        _loadDropdownData: function (sEmployeeId) {
            var oView = this.getView();
            var oViewModel = oView.getModel();
            var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");

            oViewModel.setProperty("/data", {});
            oViewModel.setProperty("/kpiRowCount", 1);
            oViewModel.setProperty("/summaryRowCount", 1);
            oViewModel.setProperty("/isPdfButtonVisible", false);
            this._showStartup();
            this._oStartupRecord = null;
            this._oStartupCriteria = null;
            oViewModel.setProperty("/startup/ytdAmount", "");
            oViewModel.setProperty("/startup/currency", "MXP");
            oViewModel.setProperty("/startup/periods", []);
            oViewModel.setProperty("/searchCriteria", {
                globalId: "",
                year: "",
                quarter: ""
            });

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

                                // Only show bonus years 2025 and later
                                if (parseInt(sYear, 10) < 2025) {
                                    return;
                                }

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
                            this._updateSearchEnabled();
                            this._loadYearToDate(sEmployeeId, oLatest.bonusYear, oLatest.bonusQuarter);
                        }
                    } else {
                        
                        oViewModel.setProperty("/availableQuarters", []);
                        oViewModel.setProperty("/isQuarterEnabled", false);
                        this.byId("bonusYearInput").setSelectedKey("");
                        this.byId("bonusQuarterInput").setSelectedKey("");
                        this._updateSearchEnabled();
                        MessageToast.show("No statements found");
                        oView.setBusy(false); 
                    }

                }.bind(this),

                error: function (oError) {
                    oView.setBusy(false);
                    this._updateSearchEnabled();
                }.bind(this)
            });
        },

        // =======================================================
        // YEAR / QUARTER DROPDOWNS
        // =======================================================
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
            this._oStartupRecord = null;
            this._oStartupCriteria = null;
            oView.getModel().setProperty("/startup/ytdAmount", "");
            oView.getModel().setProperty("/startup/periods", []);
            this._updateSearchEnabled();
        },

        onQuarterChange: function () {
            this._updateSearchEnabled();
            var oCriteria = this._readSearchCriteria();
            if (!oCriteria.globalId || !oCriteria.year || !oCriteria.quarter) {
                return;
            }
            this._loadYearToDate(oCriteria.globalId, oCriteria.year, oCriteria.quarter);
        },

        _updateSearchEnabled: function () {
            var oCriteria = this._readSearchCriteria();
            var bEnabled = !!(oCriteria.globalId && oCriteria.year && oCriteria.quarter);
            this.getView().getModel().setProperty("/isSearchEnabled", bEnabled);
        },

        // =======================================================
        // STATEMENT SEARCH
        // =======================================================
        onDetailsBack: function () {
            this._showStartup();
        },

        onGetDetailsPress: function () {
            var oCriteria = this._readSearchCriteria();
            if (this._oStartupRecord && this._oStartupCriteria &&
                this._oStartupCriteria.globalId === oCriteria.globalId &&
                this._oStartupCriteria.year === oCriteria.year &&
                this._oStartupCriteria.quarter === oCriteria.quarter) {
                this._applyStatement(this._oStartupRecord, oCriteria);
                MessageToast.show("Data loaded successfully.");
                return;
            }
            this.onSearchPress();
        },

        onSearchPress: function () {
            var oView = this.getView();
            var oCriteria = this._readSearchCriteria();

            if (!oCriteria.globalId || !oCriteria.year || !oCriteria.quarter) {
                return;
            }

            oView.setBusy(true);
            this._fetchStatement(oCriteria.globalId, oCriteria.year, oCriteria.quarter)
                .then(function (oRecord) {
                    oView.setBusy(false);
                    if (oRecord) {
                        this._oStartupRecord = oRecord;
                        this._oStartupCriteria = oCriteria;
                        this._publishStartupSummary(oRecord);
                        this._applyStatement(oRecord, oCriteria);
                        MessageToast.show("Data loaded successfully.");
                    } else {
                        oView.getModel().setProperty("/data", {});
                        oView.getModel().setProperty("/kpiRowCount", 1);
                        oView.getModel().setProperty("/summaryRowCount", 1);
                        oView.getModel().setProperty("/isPdfButtonVisible", false);
                        MessageBox.information("No records found for the selected criteria.");
                    }
                }.bind(this))
                .catch(function () {
                    oView.setBusy(false);
                    MessageBox.error("Failed to fetch data from the backend.");
                });
        },

        _readSearchCriteria: function () {
            var sHrId = this.byId("hrEmployeeIdInput") && this.byId("hrEmployeeIdInput").getValue();
            var sTreeId = this.byId("employeeIdInput") && this.byId("employeeIdInput").getValue();
            return {
                globalId: sHrId || sTreeId || "",
                year: this.byId("bonusYearInput").getSelectedKey(),
                quarter: this.byId("bonusQuarterInput").getSelectedKey()
            };
        },

        _loadYearToDate: function (sGlobalId, sYear, sQuarter) {
            var oCard = this.byId("bonusCard");
            if (oCard) {
                oCard.setBusy(true);
            }
            this._fetchStatement(sGlobalId, sYear, sQuarter)
                .then(function (oRecord) {
                    if (oCard) {
                        oCard.setBusy(false);
                    }
                    if (!oRecord) {
                        this.getView().getModel().setProperty("/startup/ytdAmount", "0");
                        this.getView().getModel().setProperty("/startup/periods", []);
                        return;
                    }
                    this._oStartupRecord = oRecord;
                    this._oStartupCriteria = {
                        globalId: sGlobalId,
                        year: sYear,
                        quarter: sQuarter
                    };
                    this._publishStartupSummary(oRecord);
                }.bind(this))
                .catch(function () {
                    if (oCard) {
                        oCard.setBusy(false);
                    }
                });
        },

        _publishStartupSummary: function (oRecord) {
            var oModel = this.getView().getModel();
            var sCurrency = oRecord.currency || "MXP";
            oModel.setProperty("/startup/currency", sCurrency);
            oModel.setProperty("/startup/ytdAmount", this._formatCleanNumber(oRecord.totalBonusYTD) || "0");
            oModel.setProperty("/startup/periods", this._buildStartupPeriods(oRecord, sCurrency));
        },

        _buildStartupPeriods: function (oRecord, sCurrency) {
            var aRows = oRecord.to_qSum || [];
            return aRows.map(function (oRow) {
                var sStart = this._formatShortDate(oRow.startQSumDate);
                var sEnd = this._formatShortDate(oRow.endQSumDate);
                var sRange = sStart && sEnd ? sStart + " - " + sEnd : (sStart || sEnd || oRow.summaryQuarter || "");
                return {
                    range: sRange,
                    amount: this._formatMoney(oRow.segmentAward, sCurrency)
                };
            }.bind(this));
        },

        _fetchStatement: function (sGlobalId, sYear, sQuarter) {
            var oODataModel = this.getOwnerComponent().getModel();
            return new Promise(function (resolve, reject) {
                oODataModel.read("/ZI_QBON_DD", {
                    filters: [
                        new Filter("global_id", FilterOperator.EQ, sGlobalId),
                        new Filter("bonusYear", FilterOperator.EQ, sYear),
                        new Filter("bonusQuarter", FilterOperator.EQ, sQuarter)
                    ],
                    urlParameters: {
                        "$expand": "to_KPIs,to_qSum"
                    },
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            resolve(this._normalizeStatement(oData.results[0]));
                        } else {
                            resolve(null);
                        }
                    }.bind(this),
                    error: function (oError) {
                        reject(oError);
                    }
                });
            }.bind(this));
        },

        _normalizeStatement: function (oRecord) {
            if (oRecord.to_KPIs && oRecord.to_KPIs.results) {
                oRecord.to_KPIs = oRecord.to_KPIs.results;
            }
            if (oRecord.to_qSum && oRecord.to_qSum.results) {
                oRecord.to_qSum = oRecord.to_qSum.results;
            }
            oRecord.to_KPIChart = this._prepareKpiChartData(oRecord.to_KPIs);
            return oRecord;
        },

        _applyStatement: function (oRecord, oCriteria) {
            var oView = this.getView();
            var iKpiLength = oRecord.to_KPIs ? oRecord.to_KPIs.length : 1;
            var iSumLength = oRecord.to_qSum ? oRecord.to_qSum.length : 1;

            oView.getModel().setProperty("/kpiRowCount", iKpiLength || 1);
            oView.getModel().setProperty("/summaryRowCount", iSumLength || 1);
            oView.getModel().setProperty("/data", oRecord);
            oView.getModel().setProperty("/searchCriteria", oCriteria);
            oView.getModel().setProperty("/isPdfButtonVisible", true);
            this._openDetails();
        },

        _openDetails: function () {
            var oStack = this.byId("detailsStack");
            if (oStack) {
                oStack.addStyleClass("detailsStackOpen");
            }
            this._notifyResultsReady();
        },

        _showStartup: function () {
            var oStack = this.byId("detailsStack");
            if (oStack) {
                oStack.removeStyleClass("detailsStackOpen");
            }
        },

        _notifyResultsReady: function () {
            var oResultsView = this.byId("resultsView");
            var fnReady = function (oLoadedView) {
                var oResultsController = oLoadedView && oLoadedView.getController();
                if (oResultsController && oResultsController.onDataReady) {
                    oResultsController.onDataReady();
                }
            };
            if (oResultsView && oResultsView.loaded) {
                oResultsView.loaded().then(fnReady);
            } else if (oResultsView) {
                fnReady(oResultsView);
            }
        },

        _formatCleanNumber: function (sValue) {
            if (sValue === null || sValue === undefined || sValue === "") {
                return "";
            }
            var fValue = parseFloat(sValue);
            if (isNaN(fValue)) {
                return String(sValue);
            }
            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        },

        _formatMoney: function (sValue, sCurrency) {
            var sNumber = this._formatCleanNumber(sValue);
            if (sNumber === "") {
                sNumber = "0";
            }
            return "$" + sNumber + (sCurrency || "");
        },

        _formatShortDate: function (sValue) {
            if (!sValue) {
                return "";
            }
            var oParse = DateFormat.getDateInstance({ pattern: "yyyyMMdd", UTC: true });
            var oDate = oParse.parse(String(sValue));
            if (!oDate) {
                return "";
            }
            return DateFormat.getDateInstance({ pattern: "MMM d", UTC: true }).format(oDate);
        },

        // =======================================================
        // CHART DATA
        // =======================================================
        _prepareKpiChartData: function (aKpis) {
            var aChart = [];
            var mSeen = {};
            if (!Array.isArray(aKpis)) {
                return aChart;
            }

            aKpis.forEach(function (oKpi) {
                var fTarget = parseFloat(oKpi.kpiResTarget);
                var fAchievement = parseFloat(oKpi.kpiResAchievement);
                var bTarget = !isNaN(fTarget);
                var bAchievement = !isNaN(fAchievement);

                oKpi.kpiResTargetValue = bTarget ? fTarget : null;
                oKpi.kpiResAchievementValue = bAchievement ? fAchievement : null;
                if (!bTarget && !bAchievement) {
                    return;
                }

                var sPeriod = this._formatChartPeriod(oKpi);
                var sCategory = oKpi.KPIName || sPeriod || oKpi.bonusQuarter || "";
                if (mSeen[sCategory]) {
                    mSeen[sCategory] += 1;
                    sCategory = sCategory + " (" + mSeen[sCategory] + ")";
                } else {
                    mSeen[sCategory] = 1;
                }

                aChart.push({
                    chartCategory: sCategory,
                    kpiResTargetValue: oKpi.kpiResTargetValue,
                    kpiResAchievementValue: oKpi.kpiResAchievementValue,
                    startKpiDate: oKpi.startKpiDate || ""
                });
            }.bind(this));

            return aChart;
        },

        _formatChartPeriod: function (oKpi) {
            var sStart = this._formatKpiDate(oKpi.startKpiDate);
            var sEnd = this._formatKpiDate(oKpi.endKpiDate);
            if (sStart && sEnd) {
                return sStart + " to " + sEnd;
            }
            return sStart || sEnd || "";
        },

        _formatKpiDate: function (sValue) {
            if (!sValue) {
                return "";
            }
            var oParse = DateFormat.getDateInstance({ pattern: "yyyyMMdd", UTC: true });
            var oDate = oParse.parse(String(sValue));
            if (!oDate) {
                return "";
            }
            var oDisplay = DateFormat.getDateInstance({ pattern: "MMM dd", UTC: true });
            return oDisplay.format(oDate);
        },

        // =======================================================
        // PERIOD HELPERS
        // =======================================================
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
        }
    });
});
