sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/BusyDialog",
    "adobeform/controller/HRValueHelpHandler.controller",
    "adobeform/controller/EmployeeValueHelpHandler.controller",
    "adobeform/model/formatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, BusyDialog, HRValueHelpHandler, EmployeeValueHelpHandler, formatter) {
    "use strict";

    return Controller.extend("adobeform.controller.Start", {

        onInit: function () {
            var oQuartersModel = this.getOwnerComponent().getModel("mQuartersModel");

            this.oValueHelpHandler = new HRValueHelpHandler(this);
            this.oEmployeeTreeHandler = new EmployeeValueHelpHandler(this);

            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var bIsHR = oUserDataModel.getProperty("/isHR");
            var bIsMgr = oUserDataModel.getProperty("/isMgr");

            if (bIsMgr && !bIsHR) {
                this._preloadTreeData();
            } else {
                var sEmpId = oUserDataModel.getProperty("/userId");
                var sDisplayName = oUserDataModel.getProperty("/displayName");
                oQuartersModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(sDisplayName, sEmpId));
                oQuartersModel.setProperty("/searchCriteria/globalId", sEmpId);
                this._updateSearchEnabled();
                this._loadDropdownData(sEmpId);
            }
        },

        _formatEmployeeLabel: function (sName, sId) {
            if (sName && sName !== sId) {
                return sName + " (" + sId + ")";
            }
            return sId || "";
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

        _mapTreeNode: function (oUser) {
            var aReports = (oUser.directReports && oUser.directReports.results) ? oUser.directReports.results : [];
            return {
                empid: oUser.userId,
                firstname: oUser.firstName,
                lastname: oUser.lastName,
                nodes: aReports.map(this._mapTreeNode.bind(this))
            };
        },

        // =======================================================
        // TREE DATA LOAD
        // =======================================================
        _preloadTreeData: async function () {
            var oView = this.getView();
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oUserDataModel = this.getOwnerComponent().getModel("mUserDataModel");
            var sRootEmpId = oUserDataModel.getProperty("/userId");

            oViewModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(oUserDataModel.getProperty("/displayName"), sRootEmpId));
            oViewModel.setProperty("/searchCriteria/globalId", sRootEmpId);
            this._updateSearchEnabled();

            try {
                var oUserData = await this._fetchSFData("/User('" + sRootEmpId + "')", {
                    "$select": "userId,firstName,lastName,directReports/userId,directReports/firstName,directReports/lastName,directReports/directReports/userId,directReports/directReports/firstName,directReports/directReports/lastName,directReports/directReports/directReports/userId,directReports/directReports/directReports/firstName,directReports/directReports/directReports/lastName",
                    "$expand": "directReports,directReports/directReports,directReports/directReports/directReports"
                });

                var oUserNode = this._mapTreeNode(oUserData);

                var sRootName = [oUserData.firstName, oUserData.lastName].filter(Boolean).join(" ");
                if (sRootName) {
                    oViewModel.setProperty("/selectedEmployeeLabel", this._formatEmployeeLabel(sRootName, sRootEmpId));
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

        _selectEmployee: function (sSelectedId, sLabel) {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            oViewModel.setProperty("/selectedEmployeeLabel", sLabel || sSelectedId);
            oViewModel.setProperty("/searchCriteria/globalId", sSelectedId);
            this.byId("bonusYearInput").setSelectedKey("");
            oViewModel.setProperty("/isYearEnabled", false);
            this._updateSearchEnabled();
            this._loadDropdownData(sSelectedId);
        },

        onEmployeeTreeValueHelp: function (oEvent) {
            this.oEmployeeTreeHandler.openTreeDialog(oEvent, function (sSelectedId, oInputBox, sLabel) {
                this._selectEmployee(sSelectedId, sLabel);
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

            this.oValueHelpHandler.openValueHelpDialog(oEvent, oConfig, "mSuccessFactorsModel", function (aSelectedTokens) {
                if (aSelectedTokens && aSelectedTokens.length > 0) {
                    var oToken = aSelectedTokens[0];
                    var sId = oToken.getKey();
                    var oRow = oToken.data("row");
                    var sName = oRow ? [oRow.firstName, oRow.lastName].filter(Boolean).join(" ") : "";
                    this._selectEmployee(sId, this._formatEmployeeLabel(sName, sId));
                }
            }.bind(this));
        },

        _openBusyDialog: function () {
            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog({
                    title: "Loading...",
                    text: "Please Wait"
                });
            }
            this._oBusyDialog.open();
        },

        _closeBusyDialog: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
        },

        onExit: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.destroy();
                this._oBusyDialog = null;
            }
        },

        // =======================================================
        // LOAD DROPDOWNS
        // =======================================================
        _loadDropdownData: function (sEmployeeId) {
            var oView = this.getView();
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oSFModel = this.getOwnerComponent().getModel("mSuccessFactorsModel");

            oViewModel.setProperty("/quarterCards", []);
            oViewModel.setProperty("/ytdAmount", "0");
            oViewModel.setProperty("/summariesLoading", false);
            this._openBusyDialog();
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
                    this._closeBusyDialog();

                    if (aYears.length > 0) {
                        var sLatestYear = aYears[aYears.length - 1].year;
                        var aQuarters = this._getQuartersForYear(aParsedPeriods, sLatestYear);

                        oViewModel.setProperty("/availableQuarters", aQuarters);
                        oViewModel.setProperty("/isYearEnabled", true);

                        this.byId("bonusYearInput").setSelectedKey(sLatestYear);
                        oViewModel.setProperty("/searchCriteria/year", sLatestYear);
                        this._updateSearchEnabled();
                        this._loadYearStatements();
                    } else {
                        oViewModel.setProperty("/availableQuarters", []);
                        oViewModel.setProperty("/isYearEnabled", false);
                        this.byId("bonusYearInput").setSelectedKey("");
                        this._updateSearchEnabled();
                        var sEmployeeLabel = oViewModel.getProperty("/selectedEmployeeLabel") || sEmployeeId;
                        MessageBox.warning("No statements found for " + sEmployeeLabel);
                        oView.setBusy(false);
                    }
                }.bind(this),
                error: function () {
                    oView.setBusy(false);
                    this._closeBusyDialog();
                    oViewModel.setProperty("/isYearEnabled", false);
                    this._updateSearchEnabled();
                }.bind(this)
            });
        },

        // =======================================================
        // YEAR / QUARTER DROPDOWNS
        // =======================================================
        _getQuartersForYear: function (aPeriods, sYear) {
            var aQuarters = [];
            (aPeriods || []).forEach(function (item) {
                if (item.bonusYear === sYear &&
                    !aQuarters.some(function (q) { return q.quarter === item.bonusQuarter; })) {
                    aQuarters.push({ quarter: item.bonusQuarter });
                }
            });
            aQuarters.sort(function (a, b) {
                return a.quarter.localeCompare(b.quarter);
            });
            return aQuarters;
        },

        onYearChange: function (oEvent) {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }
            var sSelectedYear = oSelectedItem.getKey();
            var aAllPeriods = oViewModel.getProperty("/allPeriods") || [];
            var aQuarters = this._getQuartersForYear(aAllPeriods, sSelectedYear);

            oViewModel.setProperty("/availableQuarters", aQuarters);
            oViewModel.setProperty("/searchCriteria/year", sSelectedYear);
            this._updateSearchEnabled();
            this._loadYearStatements();
        },

        // =======================================================
        // STATEMENT SEARCH
        // =======================================================
        _updateSearchEnabled: function () {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var oYearSelect = this.byId("bonusYearInput");
            var sGlobalId = oViewModel.getProperty("/searchCriteria/globalId") || "";
            var bYearSelected = !!(oYearSelect && oYearSelect.getSelectedItem());
            var aCards = oViewModel.getProperty("/quarterCards") || [];
            var bSummariesLoading = oViewModel.getProperty("/summariesLoading");

            oViewModel.setProperty(
                "/isSearchEnabled",
                !!(sGlobalId && bYearSelected && aCards.length > 0 && !bSummariesLoading)
            );
        },

        _loadYearStatements: function () {
            var oViewModel = this.getOwnerComponent().getModel("mQuartersModel");
            var sGlobalId = oViewModel.getProperty("/searchCriteria/globalId") || "";
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

            var fnFinish = function () {
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
            }.bind(this);

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
                        fnFinish();
                    },
                    error: function () {
                        aCards.push({
                            quarter: sQuarter,
                            periodDays: "",
                            totalQuarterAward: "0",
                            currency: sCurrency,
                            statement: null
                        });
                        fnFinish();
                    }
                });
            });
        },

        onContinue: function () {
            this.getOwnerComponent().getRouter().navTo("RouteQuarters");
        }
    });
});
