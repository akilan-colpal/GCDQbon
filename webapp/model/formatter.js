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
         * Formats a start/end yyyyMMdd pair into "MMM dd - MMM dd".
         */
        formatDateRange: function (sStart, sEnd) {
            var sStartText = formatShortDate(sStart);
            var sEndText = formatShortDate(sEnd);
            if (sStartText && sEndText) {
                return sStartText + " - " + sEndText;
            }
            return sStartText || sEndText || "";
        }
    };
});
