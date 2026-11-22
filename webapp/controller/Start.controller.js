sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "adobeform/controller/HRValueHelpHandler.controller",
    "adobeform/controller/EmployeeValueHelpHandler.controller",
    "adobeform/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, HRValueHelpHandler, EmployeeValueHelpHandler, formatter) {
    "use strict";

    return Controller.extend("adobeform.controller.Start", {

        onInit: function () {
            var oQuartersModel = new JSONModel({
                allPeriods: [],
                availableYears: [],
                availableQuarters: [],
                isYearEnabled: false,
                treeHierarchy: [],
                isSearchEnabled: false,
                periodsLoading: false,
                summariesLoading: false,
                selectedEmployeeLabel: "",
                quarterCards: [],
                ytdAmount: "0",
                currency: "MXP",
                searchCriteria: {
                    globalId: "",
                    year: ""
                }
            });
            var oDetailModel = new JSONModel({
                data: {},
                isPdfButtonVisible: false,
                pdfLoading: false,
                searchCriteria: {
                    globalId: "",
                    year: "",
                    quarter: ""
                }
            });
            this.getView().setModel(oQuartersModel);
            this.getOwnerComponent().setModel(oQuartersModel, "mQuartersModel");
            this.getOwnerComponent().setModel(oDetailModel, "mDetailModel");

            this.oValueHelpHandler = new HRValueHelpHandler(this);
            this.oEmployeeTreeHandler = new EmployeeValueHelpHandler(this);

            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var bIsHR = oUserDataModel.getProperty("/isHR");
            var bIsMgr = oUserDataModel.getProperty("/isMgr");

            if (bIsHR) {
                var sEmpId = oUserDataModel.getProperty("/userId");
                this.byId("employeeIdInput").setValue(sEmpId);
                oQuartersModel.setProperty("/selectedEmployeeLabel", sEmpId);
                oQuartersModel.setProperty("/searchCriteria/globalId", sEmpId);
                this._updateSearchEnabled();
                this._loadDropdownData(sEmpId);
            } else if (bIsMgr) {
                this._preloadTreeData();
            } else {
                var sEmpIdEmployee = oUserDataModel.getProperty("/userId");
                var oEmpInput = this.byId("employeeIdInput");
                if (oEmpInput) {
                    oEmpInput.setValue(sEmpIdEmployee);
                }
                oQuartersModel.setProperty("/selectedEmployeeLabel", sEmpIdEmployee);
                oQuartersModel.setProperty("/searchCriteria/globalId", sEmpIdEmployee);
                this._updateSearchEnabled();
                this._loadDropdownData(sEmpIdEmployee);
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
            oViewModel.setProperty("/selectedEmployeeLabel", sRootEmpId);
            oViewModel.setProperty("/searchCriteria/globalId", sRootEmpId);
            this._updateSearchEnabled();

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
                    oUserNode.nodes = aDirectReports.map(function (dr) {
                        var aSubReports = (dr.directReports && dr.directReports.results) ? dr.directReports.results : [];
                        return {
                            empid: dr.userId,
                            firstname: dr.firstName,
                            lastname: dr.lastName,
                            nodes: aSubReports.map(function (subDr) {
                                var aSubSubReports = (subDr.directReports && subDr.directReports.results) ? subDr.directReports.results : [];
                                return {
                                    empid: subDr.userId,
                                    firstname: subDr.firstName,
                                    lastname: subDr.lastName,
                                    nodes: aSubSubReports.map(function (subSubDr) {
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

                oViewModel.setProperty("/treeHierarchy", [oUserNode]);
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
        onEmployeeValueHelp: function (oEvent) {
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            if (oUserDataModel.getProperty("/isHR")) {
                this.onHREmployeeValueHelp(oEvent);
            } else if (oUserDataModel.getProperty("/isMgr")) {
                this.onEmployeeTreeValueHelp(oEvent);
            }
        },

        onEmployeeTreeValueHelp: function (oEvent) {
            this.oEmployeeTreeHandler.openTreeDialog(oEvent, function (sSelectedId, oInputBox) {
                oInputBox.setValue(sSelectedId);
                this.getView().getModel().setProperty("/selectedEmployeeLabel", sSelectedId);
                this.getView().getModel().setProperty("/searchCriteria/globalId", sSelectedId);

                this.byId("bonusYearInput").setSelectedKey("");
                this.getView().getModel().setProperty("/isYearEnabled", false);
                this._updateSearchEnabled();
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

            this.oValueHelpHandler.openValueHelpDialog(oEvent, oConfig, "mSuccessFactorsModel", function (aSelectedTokens, oInputBox) {
                if (aSelectedTokens && aSelectedTokens.length > 0) {
                    var sId = aSelectedTokens[0].getKey();
                    oInputBox.setValue(sId);
                    this.getView().getModel().setProperty("/selectedEmployeeLabel", sId);
                    this.getView().getModel().setProperty("/searchCriteria/globalId", sId);

                    this.byId("bonusYearInput").setSelectedKey("");
                    this.getView().getModel().setProperty("/isYearEnabled", false);
                    this._updateSearchEnabled();
                    this._loadDropdownData(sId);
                }
            }.bind(this));
        },

        // =======================================================
        // DROPDOWNS & DATA FETCHING
        // =======================================================
        onGlobalIdChange: function (oEvent) {
            var sGlobalId = oEvent.getParameter("value");

            if (sGlobalId) {
                this.getView().getModel().setProperty("/selectedEmployeeLabel", sGlobalId);
                this.getView().getModel().setProperty("/searchCriteria/globalId", sGlobalId);
                this.byId("bonusYearInput").setSelectedKey("");
                this.getView().getModel().setProperty("/isYearEnabled", false);
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

            oViewModel.setProperty("/quarterCards", []);
            oViewModel.setProperty("/ytdAmount", "0");
            oViewModel.setProperty("/periodsLoading", true);
            oViewModel.setProperty("/summariesLoading", false);
            oViewModel.setProperty("/searchCriteria", {
                globalId: sEmployeeId,
                year: ""
            });
            var oDetailModel = this.getOwnerComponent().getModel("mDetailModel");
            oDetailModel.setProperty("/data", {});
            oDetailModel.setProperty("/isPdfButtonVisible", false);
            oDetailModel.setProperty("/pdfLoading", false);
            oDetailModel.setProperty("/searchCriteria", {
                globalId: sEmployeeId,
                year: "",
                quarter: ""
            });
            this.byId("bonusYearInput").setSelectedKey("");
            oViewModel.setProperty("/isYearEnabled", false);
            this._updateSearchEnabled();

            var aFilters = [
                new Filter("externalCode", FilterOperator.EQ, sEmployeeId)
            ];
            oSFModel.read("/cust_VarPayEmpHistData", {
                filters: aFilters,
                urlParameters: {
                    "fromDate": "1900-01-01",
                    "toDate": "9999-12-31",
                    "$select": "cust_VarPayTemplateName",
                    "$orderby": "cust_VarPayTemplateName desc"
                },
                success: function (oData) {
                    var aResults = oData.results || [];
                    var aYears = [];
                    var aParsedPeriods = [];

                    aResults.forEach(function (item) {
                        var sTemplateName = item.cust_VarPayTemplateName;

                        if (sTemplateName) {
                            var aMatch = sTemplateName.match(/(\d{4})\s+(Q[1-4])/i);
                            if (aMatch) {
                                var sYear = aMatch[1];
                                var sQuarter = aMatch[2].toUpperCase();

                                if (parseInt(sYear, 10) < 2025) {
                                    return;
                                }

                                aParsedPeriods.push({
                                    bonusYear: sYear,
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
                    oViewModel.setProperty("/periodsLoading", false);

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
                            oViewModel.setProperty("/isYearEnabled", aYears.length > 0);

                            this.byId("bonusYearInput").setSelectedKey(oLatest.bonusYear);
                            oViewModel.setProperty("/searchCriteria/year", oLatest.bonusYear);
                            this._updateSearchEnabled();
                            this._loadYearStatements();
                        }
                    } else {
                        oViewModel.setProperty("/availableQuarters", []);
                        oViewModel.setProperty("/isYearEnabled", false);
                        this.byId("bonusYearInput").setSelectedKey("");
                        this._updateSearchEnabled();
                        MessageBox.warning("No statements found");
                        oView.setBusy(false);
                    }
                }.bind(this),
                error: function () {
                    oView.setBusy(false);
                    oViewModel.setProperty("/periodsLoading", false);
                    oViewModel.setProperty("/isYearEnabled", false);
                    this._updateSearchEnabled();
                }.bind(this)
            });
        },

        // =======================================================
        // YEAR / QUARTER DROPDOWNS
        // =======================================================
        onYearChange: function (oEvent) {
            var oView = this.getView();
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }
            var sSelectedYear = oSelectedItem.getKey();
            var aAllPeriods = oView.getModel().getProperty("/allPeriods") || [];
            var aQuarters = [];

            aAllPeriods.forEach(function (item) {
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
            aQuarters.sort(function (a, b) { return a.quarter.localeCompare(b.quarter); });

            oView.getModel().setProperty("/availableQuarters", aQuarters);
            oView.getModel().setProperty("/searchCriteria/year", sSelectedYear);
            this._updateSearchEnabled();
            this._loadYearStatements();
        },

        // =======================================================
        // STATEMENT SEARCH
        // =======================================================
        _getSelectedGlobalId: function () {
            var sTreeId = this.byId("employeeIdInput") && this.byId("employeeIdInput").getValue();
            if (sTreeId) {
                return sTreeId;
            }
            return "";
        },

        _updateSearchEnabled: function () {
            var oYearSelect = this.byId("bonusYearInput");
            var sGlobalId = this._getSelectedGlobalId();
            var bYearSelected = !!(oYearSelect && oYearSelect.getSelectedItem());
            var aCards = this.getView().getModel().getProperty("/quarterCards") || [];
            var bSummariesLoading = this.getView().getModel().getProperty("/summariesLoading");

            this.getView().getModel().setProperty(
                "/isSearchEnabled",
                !!(sGlobalId && bYearSelected && aCards.length > 0 && !bSummariesLoading)
            );
        },

        _loadYearStatements: function () {
            var oView = this.getView();
            var oViewModel = oView.getModel();
            var sGlobalId = this._getSelectedGlobalId();
            var sYear = this.byId("bonusYearInput").getSelectedKey();
            var aQuarters = oViewModel.getProperty("/availableQuarters") || [];
            var oODataModel = this.getOwnerComponent().getModel();
            var oQuarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

            if (!sGlobalId || !sYear || aQuarters.length === 0) {
                oViewModel.setProperty("/quarterCards", []);
                oViewModel.setProperty("/ytdAmount", "0");
                oViewModel.setProperty("/summariesLoading", false);
                this._updateSearchEnabled();
                return;
            }

            oViewModel.setProperty("/summariesLoading", true);
            this._updateSearchEnabled();

            var iPending = aQuarters.length;
            var aCards = [];
            var sYtdAmount = "0";
            var sCurrency = "MXP";
            var iBestRank = -1;

            aQuarters.forEach(function (oQuarterItem) {
                var sQuarter = oQuarterItem.quarter;
                var aFilters = [
                    new Filter("global_id", FilterOperator.EQ, sGlobalId),
                    new Filter("bonusYear", FilterOperator.EQ, sYear),
                    new Filter("bonusQuarter", FilterOperator.EQ, sQuarter)
                ];

                oODataModel.read("/ZI_QBON_DD", {
                    filters: aFilters,
                    urlParameters: {
                        "$expand": "to_KPIs,to_qSum"
                    },
                    success: function (oData) {
                        var oRecord = null;
                        var sPeriod = "";
                        var sAward = "0";
                        var sCardCurrency = sCurrency;

                        if (oData.results && oData.results.length > 0) {
                            oRecord = oData.results[0];

                            if (oRecord.to_KPIs && oRecord.to_KPIs.results) {
                                oRecord.to_KPIs = oRecord.to_KPIs.results;
                            }
                            if (oRecord.to_qSum && oRecord.to_qSum.results) {
                                oRecord.to_qSum = oRecord.to_qSum.results;
                            }

                            sPeriod = formatter.spanPeriodRangeForQuarter(oRecord.to_qSum || [], sQuarter);
                            sAward = oRecord.totalQuarterAward || "0";
                            sCardCurrency = oRecord.currency || "MXP";

                            var iRank = oQuarterOrder[sQuarter] || 0;
                            if (iRank >= iBestRank) {
                                iBestRank = iRank;
                                sYtdAmount = oRecord.totalBonusYTD || "0";
                                sCurrency = sCardCurrency;
                            }
                        }

                        aCards.push({
                            quarter: sQuarter,
                            periodDays: sPeriod,
                            totalQuarterAward: sAward,
                            currency: sCardCurrency,
                            statement: oRecord
                        });

                        iPending = iPending - 1;
                        if (iPending === 0) {
                            aCards.sort(function (a, b) {
                                return String(a.quarter).localeCompare(String(b.quarter));
                            });
                            oViewModel.setProperty("/quarterCards", aCards);
                            oViewModel.setProperty("/ytdAmount", sYtdAmount);
                            oViewModel.setProperty("/currency", sCurrency);
                            oViewModel.setProperty("/summariesLoading", false);
                            this._updateSearchEnabled();
                        }
                    }.bind(this),
                    error: function () {
                        aCards.push({
                            quarter: sQuarter,
                            periodDays: "",
                            totalQuarterAward: "0",
                            currency: sCurrency,
                            statement: null
                        });
                        iPending = iPending - 1;
                        if (iPending === 0) {
                            aCards.sort(function (a, b) {
                                return String(a.quarter).localeCompare(String(b.quarter));
                            });
                            oViewModel.setProperty("/quarterCards", aCards);
                            oViewModel.setProperty("/ytdAmount", sYtdAmount);
                            oViewModel.setProperty("/currency", sCurrency);
                            oViewModel.setProperty("/summariesLoading", false);
                            this._updateSearchEnabled();
                        }
                    }.bind(this)
                });
            }.bind(this));
        },

        onContinue: function () {
            var oViewModel = this.getView().getModel();
            oViewModel.setProperty("/searchCriteria/globalId", this._getSelectedGlobalId());
            oViewModel.setProperty("/searchCriteria/year", this.byId("bonusYearInput").getSelectedKey());
            this.getOwnerComponent().getRouter().navTo("RouteQuarters");
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
