sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";

    var oParser = DateFormat.getDateInstance({ pattern: "yyyyMMdd" });

    function formatShortDate(sYyyyMmDd) {
        if (!sYyyyMmDd) {
            return "";
        }
        var oDate = oParser.parse(String(sYyyyMmDd).trim());
        if (!oDate) {
            return "";
        }
        return DateFormat.getDateInstance({ pattern: "MMM dd" }).format(oDate);
    }

    return {
        /**
         * Date span for one bonus quarter using Edm.String (yyyyMMdd) dates.
         */
        spanPeriodRangeForQuarter: function (aRows, sQuarter) {
            var sQuarterKey = String(sQuarter || "").toUpperCase();
            var aFiltered = (aRows || []).filter(function (oRow) {
                return String(oRow.summaryQuarter || "").toUpperCase().indexOf(sQuarterKey) !== -1;
            });
            var aUse = aFiltered.length ? aFiltered : (aRows || []);

            var sStart = "";
            var sEnd = "";
            aUse.forEach(function (oRow) {
                var sRowStart = oRow.startQSumDate || "";
                var sRowEnd = oRow.endQSumDate || "";
                if (sRowStart && (!sStart || sRowStart < sStart)) {
                    sStart = sRowStart;
                }
                if (sRowEnd && (!sEnd || sRowEnd > sEnd)) {
                    sEnd = sRowEnd;
                }
            });

            var sStartText = formatShortDate(sStart);
            var sEndText = formatShortDate(sEnd);
            if (sStartText && sEndText) {
                return sStartText + " - " + sEndText;
            }
            return sStartText || sEndText || "";
        }
    };
});
